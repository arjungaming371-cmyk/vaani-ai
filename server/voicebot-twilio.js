// NIAT Admissions — TWILIO voicebot server (primary voice stack).
//
//   Twilio <Connect><Stream>  ──WebSocket──▶  this server
//        μ-law 8kHz audio in  ──▶  self-hosted Whisper STT (server/stt-service)
//        text ──▶ Next.js /api/calls/turn (Aria's brain: Ollama + memory)
//        reply text ──▶ ELEVENLABS TTS (ulaw_8000 — Twilio's native format,
//                        streamed straight back, no ffmpeg needed)
//
// Twilio setup:
//   1. Buy/verify a number, set TWILIO_* vars in .env
//   2. Expose this server publicly: wss://YOUR-DOMAIN/voicebot-twilio
//      and set VOICEBOT_PUBLIC_WSS_URL to that URL
//
// ElevenLabs setup:
//   ELEVENLABS_API_KEY=...            (required)
//   ELEVENLABS_VOICE_ID=...           (default voice, e.g. a warm Indian female)
//   ELEVENLABS_VOICE_ID_HINDI=...     (optional per-language overrides)
//   ELEVENLABS_VOICE_ID_TELUGU=...
//   ELEVENLABS_MODEL=eleven_multilingual_v2  (handles EN/HI/TE in one model)
//
// Run: node server/voicebot-twilio.js   (default port 3004)

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const http = require("http")
const { WebSocketServer } = require("ws")

const PORT = parseInt(process.env.TWILIO_VOICEBOT_PORT || "3004")
const APP_URL = process.env.APP_INTERNAL_URL || "http://127.0.0.1:3000"
const STT_URL = process.env.STT_URL || process.env.STT_SERVICE_URL || "http://127.0.0.1:3003"
const API_KEY = process.env.WHATSAPP_SERVICE_KEY || "" // shared internal key

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || ""
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2"
const VOICE_DEFAULT = process.env.ELEVENLABS_VOICE_ID || ""
const VOICES = {
  english: process.env.ELEVENLABS_VOICE_ID_ENGLISH || VOICE_DEFAULT,
  hindi: process.env.ELEVENLABS_VOICE_ID_HINDI || VOICE_DEFAULT,
  telugu: process.env.ELEVENLABS_VOICE_ID_TELUGU || VOICE_DEFAULT,
}

const SAMPLE_RATE = 8000
const SILENCE_MS = 900          // pause length that ends the caller's turn
const MIN_SPEECH_MS = 350       // ignore blips shorter than this
const MAX_TURN_MS = 15000       // hard cap per utterance

if (!ELEVEN_KEY) console.error("⚠️  ELEVENLABS_API_KEY not set — Aria will have no voice!")
if (!API_KEY) console.error("⚠️  WHATSAPP_SERVICE_KEY not set — turn API calls will be rejected")

// ---------- μ-law codec (Twilio streams G.711 μ-law) ----------
const MULAW_DECODE = new Int16Array(256)
for (let i = 0; i < 256; i++) {
  let u = ~i & 0xff
  let t = ((u & 0x0f) << 3) + 0x84
  t <<= (u & 0x70) >> 4
  MULAW_DECODE[i] = (u & 0x80 ? 0x84 - t : t - 0x84)
}
function mulawToPcm(buf) {
  const out = Buffer.alloc(buf.length * 2)
  for (let i = 0; i < buf.length; i++) out.writeInt16LE(MULAW_DECODE[buf[i]], i * 2)
  return out
}

function pcmToWav(pcm) {
  const header = Buffer.alloc(44)
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8); header.write("fmt ", 12)
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

// Simple energy-based voice activity detection on 16-bit PCM
function frameEnergy(pcm) {
  let sum = 0
  for (let i = 0; i < pcm.length; i += 2) sum += Math.abs(pcm.readInt16LE(i))
  return sum / (pcm.length / 2)
}
const ENERGY_THRESHOLD = 500

// ---------- Whisper STT (self-hosted) ----------
async function speechToText(pcm, language) {
  const res = await fetch(`${STT_URL}/transcribe?language=${encodeURIComponent(language)}`, {
    method: "POST",
    headers: { "Content-Type": "audio/wav", "x-api-key": API_KEY },
    body: pcmToWav(pcm),
  })
  if (!res.ok) throw new Error(`STT HTTP ${res.status} — is server/stt-service running?`)
  const data = await res.json()
  return (data?.text || "").trim()
}

// ---------- ElevenLabs TTS → μ-law 8kHz (Twilio-native, zero transcoding) ----------
async function ttsUlaw8k(text, language) {
  const voiceId = VOICES[language] || VOICE_DEFAULT
  if (!ELEVEN_KEY || !voiceId) throw new Error("ElevenLabs not configured (API key / voice ID missing)")
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=ulaw_8000`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: ELEVEN_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`ElevenLabs HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

// ---------- Aria's brain ----------
async function callTurnApi(payload) {
  const res = await fetch(`${APP_URL}/api/calls/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`turn API HTTP ${res.status}`)
  return res.json()
}

// ---------- Greeting cache: instant first words, no TTS delay ----------
const greetingCache = new Map() // language -> ulaw buffer
async function warmGreetings() {
  const GREETINGS = {
    english: "Hello! This is Aria calling from NIAT — NxtWave Institute of Advanced Technologies. You had shown interest in our B.Tech program. This will take just one minute. May I know the student's full name, please?",
    hindi: "नमस्ते! मैं Aria बोल रही हूं, NIAT — NxtWave Institute of Advanced Technologies से। आपने हमारे B.Tech प्रोग्राम में रुचि दिखाई थी। सिर्फ एक मिनट लगेगा। कृपया स्टूडेंट का पूरा नाम बताएं?",
    telugu: "నమస్కారం! నేను Aria, NIAT — NxtWave Institute of Advanced Technologies నుండి మాట్లాడుతున్నాను. మీరు మా B.Tech ప్రోగ్రామ్‌పై ఆసక్తి చూపారు. ఒక్క నిమిషం చాలు. దయచేసి స్టూడెంట్ పూర్తి పేరు చెప్పండి?",
  }
  for (const [lang, text] of Object.entries(GREETINGS)) {
    try {
      greetingCache.set(lang, await ttsUlaw8k(text, lang))
      console.log(`✅ Greeting cached (${lang})`)
    } catch (e) {
      console.error(`Greeting cache failed (${lang}):`, e.message)
    }
  }
}

// ---------- Per-call session ----------
class CallSession {
  constructor(ws) {
    this.ws = ws
    this.streamSid = null
    this.callSid = null
    this.leadId = ""
    this.language = "english"
    this.buffer = []          // PCM chunks of current utterance
    this.speechMs = 0
    this.silenceMs = 0
    this.speaking = false     // Aria is talking — don't listen to her own voice
    this.processing = false
    this.closed = false
  }

  sendAudio(ulawBuf) {
    // Twilio expects base64 μ-law in ~20ms media frames; a single big payload also works
    const CHUNK = 8000 // 1 second per frame keeps message count low
    for (let i = 0; i < ulawBuf.length; i += CHUNK) {
      this.ws.send(JSON.stringify({
        event: "media",
        streamSid: this.streamSid,
        media: { payload: ulawBuf.subarray(i, i + CHUNK).toString("base64") },
      }))
    }
    // Mark lets us know when Twilio finished playing (approximate via timer instead)
    this.ws.send(JSON.stringify({ event: "mark", streamSid: this.streamSid, mark: { name: "eos" } }))
  }

  async speak(text) {
    this.speaking = true
    try {
      const audio = await ttsUlaw8k(text, this.language)
      this.sendAudio(audio)
      // μ-law 8k = 8000 bytes/sec → estimate playback time, then resume listening
      const playMs = Math.ceil((audio.length / 8000) * 1000)
      await new Promise((r) => setTimeout(r, playMs + 200))
    } finally {
      this.speaking = false
      this.buffer = []; this.speechMs = 0; this.silenceMs = 0
    }
  }

  async speakGreeting() {
    const cached = greetingCache.get(this.language)
    if (cached) {
      this.speaking = true
      this.sendAudio(cached)
      const playMs = Math.ceil((cached.length / 8000) * 1000)
      await new Promise((r) => setTimeout(r, playMs + 200))
      this.speaking = false
      // Register the call + greeting in the DB (fire-and-forget)
      callTurnApi({ event: "start", leadId: this.leadId, callSid: this.callSid, language: this.language }).catch(() => {})
    } else {
      const data = await callTurnApi({ event: "start", leadId: this.leadId, callSid: this.callSid, language: this.language }).catch(() => null)
      await this.speak(data?.text || "Hello! This is Aria from NIAT.")
    }
  }

  onMedia(payloadB64) {
    if (this.speaking || this.processing || this.closed) return
    const pcm = mulawToPcm(Buffer.from(payloadB64, "base64"))
    const frameMs = (pcm.length / 2 / SAMPLE_RATE) * 1000
    const energetic = frameEnergy(pcm) > ENERGY_THRESHOLD

    if (energetic) {
      this.buffer.push(pcm)
      this.speechMs += frameMs
      this.silenceMs = 0
    } else if (this.speechMs > 0) {
      this.buffer.push(pcm) // keep trailing silence for natural word ends
      this.silenceMs += frameMs
    }

    const turnOver = this.speechMs >= MIN_SPEECH_MS && this.silenceMs >= SILENCE_MS
    const tooLong = this.speechMs + this.silenceMs >= MAX_TURN_MS
    if (turnOver || tooLong) this.processTurn()
  }

  async processTurn() {
    if (this.processing) return
    this.processing = true
    const pcm = Buffer.concat(this.buffer)
    this.buffer = []; this.speechMs = 0; this.silenceMs = 0

    try {
      const speech = await speechToText(pcm, this.language)
      if (!speech) { this.processing = false; return }
      console.log(`[${this.callSid}] Caller: ${speech}`)

      const data = await callTurnApi({
        event: "turn", leadId: this.leadId, callSid: this.callSid,
        language: this.language, speech,
      })
      const reply = data?.text || ""
      console.log(`[${this.callSid}] Aria: ${reply.slice(0, 80)}`)
      if (reply) await this.speak(reply)
      if (data?.hangup) this.hangup()
    } catch (e) {
      console.error(`[${this.callSid}] turn error:`, e.message)
    } finally {
      this.processing = false
    }
  }

  hangup() {
    this.closed = true
    try { this.ws.close() } catch {}
  }
}

// ---------- WebSocket server (Twilio connects here) ----------
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, service: "niat-twilio-voicebot", elevenlabs: !!ELEVEN_KEY }))
    return
  }
  res.writeHead(404); res.end()
})

const wss = new WebSocketServer({ server, path: "/voicebot-twilio" })

wss.on("connection", (ws) => {
  const session = new CallSession(ws)
  console.log("Twilio stream connected")

  ws.on("message", async (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    switch (msg.event) {
      case "start": {
        session.streamSid = msg.start?.streamSid
        session.callSid = msg.start?.callSid || null
        const params = msg.start?.customParameters || {}
        session.leadId = params.leadId || ""
        session.language = (params.language || "english").toLowerCase()
        console.log(`Call started: sid=${session.callSid} lead=${session.leadId} lang=${session.language}`)
        session.speakGreeting().catch((e) => console.error("greeting error:", e.message))
        break
      }
      case "media":
        session.onMedia(msg.media?.payload || "")
        break
      case "stop":
        console.log(`Call ended: ${session.callSid}`)
        session.closed = true
        // Tell the app the call finished so it can run the AI summary
        callTurnApi({ event: "end", leadId: session.leadId, callSid: session.callSid, language: session.language }).catch(() => {})
        break
    }
  })

  ws.on("close", () => { session.closed = true })
  ws.on("error", (e) => console.error("ws error:", e.message))
})

server.listen(PORT, () => {
  console.log(`NIAT Twilio voicebot on ws://127.0.0.1:${PORT}/voicebot-twilio`)
  console.log(`Expose publicly as: ${process.env.VOICEBOT_PUBLIC_WSS_URL || "wss://YOUR-DOMAIN/voicebot-twilio (set VOICEBOT_PUBLIC_WSS_URL)"}`)
  warmGreetings()
})
