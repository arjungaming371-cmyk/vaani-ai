// Free TTS via Microsoft Edge neural voices (msedge-tts) — replaces ElevenLabs.
//
// Voices (all free, natural-sounding neural voices with proper Indian accents):
//   english → en-IN-NeerjaNeural
//   hindi   → hi-IN-SwaraNeural
//   telugu  → te-IN-ShrutiNeural
//
// NOTE: like whatsapp-web.js, this uses an unofficial-but-widely-used client
// for a free Microsoft endpoint. Zero cost, no API key. If it ever breaks,
// the drop-in paid replacements are Azure Speech (same voices, official) or
// ElevenLabs — only this file would change.

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts"
import type { Language } from "./ollama"

const VOICES: Record<Language, string> = {
  english: "en-IN-NeerjaNeural",
  hindi: "hi-IN-SwaraNeural",
  telugu: "te-IN-ShrutiNeural",
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(c))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}

/** MP3 audio for the dashboard chat "speak" feature. Returns null on failure. */
export async function textToSpeech(text: string, language: Language = "english"): Promise<Buffer | null> {
  const clean = text?.trim().slice(0, 1000)
  if (!clean) return null
  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(VOICES[language] || VOICES.english, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const audioStream = tts.toStream(clean)
    const buf = await streamToBuffer(audioStream)
    return buf.length > 0 ? buf : null
  } catch (e: any) {
    console.error("Edge TTS error:", e.message)
    return null
  }
}

export async function checkTtsHealth(): Promise<{ ok: boolean; message: string }> {
  const buf = await textToSpeech("test", "english")
  return buf
    ? { ok: true, message: "Edge TTS working (free Microsoft neural voices)" }
    : { ok: false, message: "Edge TTS unreachable — check server internet access" }
}
