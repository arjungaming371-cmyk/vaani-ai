// Local AI via Ollama — Vaani, the AI front-desk voice agent.
// Cloud demo: if GROQ_API_KEY is set, the same prompts run on Groq-hosted Llama 3.1 8B.
// Job on calls: build trust fast, handle objections, and collect
// name + address + WhatsApp number, then hand off to the WhatsApp form link.

export type Language = "english" | "hindi" | "telugu"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b"
const IS_GPU = process.env.OLLAMA_GPU === "true"

// ---- Concurrency cap ----------------------------------------------------
// llama3.1:8b on a laptop can realistically serve 1-2 generations at once.
// Without a cap, three simultaneous calls each take 3x longer and ALL of
// them blow the per-turn timeout. With the cap, excess requests queue
// briefly and every caller still gets a fast reply.
const MAX_CONCURRENT = Math.max(1, parseInt(process.env.OLLAMA_MAX_CONCURRENT || (IS_GPU ? "2" : "1")))
const MAX_QUEUE_WAIT_MS = 8000 // give up waiting rather than stall a live call

let active = 0
const waiters: { resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }[] = []

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  return new Promise((resolve, reject) => {
    const entry = {
      resolve: () => {
        active++
        resolve()
      },
      reject,
      timer: setTimeout(() => {
        const i = waiters.indexOf(entry)
        if (i >= 0) waiters.splice(i, 1)
        reject(new Error("Ollama busy — queue wait exceeded"))
      }, MAX_QUEUE_WAIT_MS),
    }
    waiters.push(entry)
  })
}

function releaseSlot(): void {
  active = Math.max(0, active - 1)
  const next = waiters.shift()
  if (next) {
    clearTimeout(next.timer)
    next.resolve()
  }
}
// -------------------------------------------------------------------------

// Compact conversation script. Kept tight on purpose — every extra token
// slows down llama3.1:8b replies during a live call.
// Default fallback scripts (used when DB is unavailable)
const DEFAULT_SCRIPTS: Record<Language, string> = {
  english: `You are Vaani, the friendly AI front-desk assistant of the business configured in the dashboard. Demo default: Lakshmi Dental Clinic, Hyderabad (general dentistry, root canal Rs 4000-7000, free braces consultation, cleaning Rs 1200; Mon-Sat 10am-8pm).

STYLE: Short sentences. One idea per sentence. Ask ONE question at a time, then stop. Warm, helpful, never pushy.

YOUR GOALS on this call:
1) Answer questions about services, prices, and timings using ONLY the facts above.
2) Book the customer: collect their name and preferred day/time, then confirm clearly.
3) Tell them a WhatsApp confirmation with details will be sent.

RULES:
- Reply in the SAME language the customer speaks.
- Never invent services or prices. If unsure, say the owner will call them back.
- Never ask for OTP, PIN, or any payment — say so if safety comes up.
- If asked "are you a robot?": answer honestly — "I'm Vaani, this business's AI assistant."`,

  hindi: `आप Vaani हैं — डैशबोर्ड में सेट किए गए बिज़नेस की AI फ्रंट-डेस्क असिस्टेंट। डेमो डिफ़ॉल्ट: Lakshmi Dental Clinic, Hyderabad (जनरल डेंटिस्ट्री, रूट कैनाल Rs 4000-7000, ब्रेसेस कंसल्टेशन फ्री, क्लीनिंग Rs 1200; सोम-शनि 10am-8pm)।

स्टाइल: छोटे वाक्य। एक बार में एक ही सवाल। गर्मजोशी से, बिना दबाव के।

लक्ष्य: 1) सेवाओं/कीमतों/समय के सवालों का जवाब सिर्फ ऊपर दिए तथ्यों से दें। 2) अपॉइंटमेंट बुक करें: नाम और पसंदीदा दिन/समय लें, फिर साफ कन्फर्म करें। 3) बताएं कि WhatsApp पर कन्फर्मेशन आएगा।

नियम: ग्राहक जिस भाषा में बोले, उसी में जवाब दें। कोई सेवा/कीमत खुद से न बनाएं। OTP, PIN या पेमेंट कभी न मांगें। "क्या आप रोबोट हैं?" पर सच कहें — "मैं Vaani हूं, इस बिज़नेस की AI असिस्टेंट।"`,

  telugu: `మీరు Vaani — డాష్‌బోర్డ్‌లో సెట్ చేసిన బిజినెస్ యొక్క AI ఫ్రంట్-డెస్క్ అసిస్టెంట్. డెమో డిఫాల్ట్: Lakshmi Dental Clinic, Hyderabad (జనరల్ డెంటిస్ట్రీ, రూట్ కెనాల్ Rs 4000-7000, బ్రేసెస్ కన్సల్టేషన్ ఫ్రీ, క్లీనింగ్ Rs 1200; సోమ-శని 10am-8pm).

స్టైల్: చిన్న వాక్యాలు. ఒకసారి ఒకే ప్రశ్న. ఆప్యాయంగా, ఒత్తిడి లేకుండా.

లక్ష్యాలు: 1) సేవలు/ధరలు/టైమింగ్స్ ప్రశ్నలకు పై వాస్తవాలతోనే జవాబివ్వండి. 2) అపాయింట్‌మెంట్ బుక్ చేయండి: పేరు, ఇష్టమైన రోజు/టైమ్ తీసుకుని స్పష్టంగా కన్ఫర్మ్ చేయండి. 3) WhatsApp లో కన్ఫర్మేషన్ వస్తుందని చెప్పండి.

రూల్స్: కస్టమర్ మాట్లాడే భాషలోనే జవాబివ్వండి. సేవలు/ధరలు సొంతంగా కల్పించవద్దు. OTP, PIN, పేమెంట్ ఎప్పుడూ అడగవద్దు. "మీరు రోబోటా?" అంటే నిజం చెప్పండి — "నేను Vaani, ఈ బిజినెస్ AI అసిస్టెంట్."`,
}

// Script cache — refreshed every 5 minutes so dashboard changes take
// effect quickly without hitting the DB on every single call turn.
let _scriptCache: Record<string, string> = {}
let _scriptCacheTime = 0
const SCRIPT_CACHE_TTL = 5 * 60 * 1000

async function getSystemPrompt(language: Language): Promise<string> {
  const now = Date.now()
  if (now - _scriptCacheTime < SCRIPT_CACHE_TTL && _scriptCache[language]) {
    return _scriptCache[language]
  }
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT content FROM ai_scripts WHERE language = $1 LIMIT 1`,
      [language]
    )
    if (result.rows?.[0]?.content) {
      _scriptCache[language] = result.rows[0].content
      _scriptCacheTime = now
      return result.rows[0].content
    }
  } catch {
    // DB unavailable — fall through to default
  }
  return DEFAULT_SCRIPTS[language] || DEFAULT_SCRIPTS.english
}
interface OllamaMessage { role: "system" | "user" | "assistant"; content: string }

function toOllamaMessages(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt: string
): OllamaMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ]
}

export async function chatWithOllama(
  messages: { role: "user" | "model"; content: string }[],
  language: Language = "english",
  extraInstructions?: string
): Promise<string> {
  if (!messages?.length) return "Hello! How can I help you today?"

  const recentMessages = messages.slice(-6)
  let systemPrompt = await getSystemPrompt(language)
  if (extraInstructions?.trim()) {
    systemPrompt += `\n\nAdditional context for this specific call (from the operations team): ${extraInstructions.trim()}`
  }
  const ollamaMessages = toOllamaMessages(recentMessages, systemPrompt)

  // Cloud demo path: Groq-hosted Llama 3.1 8B (same model family, same prompts).
  const GROQ_KEY = process.env.GROQ_API_KEY || ""
  if (GROQ_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
          messages: ollamaMessages,
          temperature: 0.6,
          max_tokens: 300,
        }),
      })
      if (res.ok) {
        const data: any = await res.json()
        const content = data?.choices?.[0]?.message?.content?.trim()
        if (content) return content
      } else {
        console.error("Groq HTTP", res.status)
      }
    } catch (e: any) {
      console.error("Groq failed, falling back to Ollama:", e.message)
    }
  }

  const controller = new AbortController()
  const timeoutMs = IS_GPU ? 10000 : 25000

  await acquireSlot()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: ollamaMessages,
        stream: false,
        // keep_alive keeps the model loaded in RAM between turns —
        // without it, every reply pays a multi-second model reload.
        keep_alive: "30m",
        options: IS_GPU
          ? { num_predict: 120, temperature: 0.6, num_ctx: 2048, num_gpu: 99 }
          : { num_predict: 80, temperature: 0.6, num_ctx: 1536, num_thread: 8 },
      }),
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)
    const data = await response.json()
    const text = data?.message?.content
    if (!text || !text.trim()) throw new Error("Empty Ollama response")
    return text.trim()
  } catch (e: any) {
    clearTimeout(timeoutId)
    console.error("Ollama error:", e.message)
    throw e
  } finally {
    releaseSlot()
  }
}

export type ExtractedLead = {
  name: string | null
  address: string | null
  whatsapp_number: string | null
  complete: boolean
  interested: boolean | null
}

/**
 * Cheap pre-check before running lead extraction. Since a lead can only be
 * "complete" once a WhatsApp number exists, there is no point paying for an
 * extra Ollama round-trip until the transcript actually contains a
 * phone-number-looking string. This keeps most turns to ONE model call.
 */
export function mightBeComplete(transcriptText: string): boolean {
  return /\d[\d\s\-()]{8,}\d/.test(transcriptText)
}

/**
 * Reads the running transcript and decides: do we have name + address +
 * WhatsApp number yet? Used by the voice handler to know when to stop the
 * conversation, save the lead, and send the WhatsApp application link.
 */
export async function extractLeadInfo(transcriptText: string): Promise<ExtractedLead> {
  const empty: ExtractedLead = { name: null, address: null, whatsapp_number: null, complete: false, interested: null }
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Return ONLY valid JSON, no other text. From the call transcript, extract: " +
              '"name" (string or null), "address" (string or null, city/area is enough), ' +
              '"whatsapp_number" (string or null, digits only, include country code if given), ' +
              '"complete" (true only if ALL THREE of name, address, whatsapp_number are known), ' +
              '"interested" (true if customer sounds interested/positive, false if clearly not interested, null if unclear).',
          },
          { role: "user", content: transcriptText },
        ],
        stream: false,
        format: "json",
        keep_alive: "30m",
        options: { temperature: 0.1, num_predict: 150 },
      }),
    })
    clearTimeout(timeoutId)
    const data = await response.json()
    const text = data?.message?.content
    const parsed = JSON.parse(text || "{}")
    return {
      name: typeof parsed.name === "string" ? parsed.name : null,
      address: typeof parsed.address === "string" ? parsed.address : null,
      whatsapp_number: typeof parsed.whatsapp_number === "string" ? parsed.whatsapp_number.replace(/[^\d+]/g, "") : null,
      complete: !!parsed.complete,
      interested: typeof parsed.interested === "boolean" ? parsed.interested : null,
    }
  } catch (e) {
    console.error("extractLeadInfo error:", e)
    return empty
  }
}

export async function generateLeadSummary(transcript: string): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Return ONLY valid JSON, no other text." },
          { role: "user", content: `Summarize this call with keys: lead_name, address, whatsapp_number, next_action, sentiment.\n\n${transcript}` },
        ],
        stream: false,
        format: "json",
        keep_alive: "30m",
        options: { temperature: 0.2, num_predict: 150 },
      }),
    })
    const data = await response.json()
    const text = data?.message?.content
    return text && text.trim() ? text.trim() : "{}"
  } catch (e) {
    console.error("Summary generation error:", e)
    return "{}"
  }
}

export function detectLanguage(text: string): Language {
  if (/[\u0C00-\u0C7F]/.test(text)) return "telugu"
  if (/[\u0900-\u097F]/.test(text)) return "hindi"
  return "english"
}

export async function checkOllamaHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return { ok: false, message: `Ollama not responding: HTTP ${res.status}` }
    const data = await res.json()
    const hasModel = data?.models?.some((m: any) => m.name === MODEL || m.name === `${MODEL}:latest`)
    if (!hasModel) return { ok: false, message: `Model ${MODEL} not found. Run: ollama pull ${MODEL}` }
    return { ok: true, message: `Ollama ready with ${MODEL}` }
  } catch (e: any) {
    return { ok: false, message: `Cannot reach Ollama at ${OLLAMA_URL}. Error: ${e.message}` }
  }
}
