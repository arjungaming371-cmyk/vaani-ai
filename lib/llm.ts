// LLM provider abstraction.
//
// Production (self-hosted):  OLLAMA_URL set  → Ollama, Llama 3.1 8B on the business's machine.
// Cloud demo (judges):       GROQ_API_KEY set → Groq's hosted Llama 3.1 8B (same model family).
//
// Same model, same prompts — only the host differs. Priority: Groq if key
// present (Vercel), otherwise Ollama (local).

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

const GROQ_KEY = process.env.GROQ_API_KEY || ""
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant"
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b"

export function providerName(): string {
  return GROQ_KEY ? `Groq · ${GROQ_MODEL}` : `Ollama · ${OLLAMA_MODEL} (self-hosted)`
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  if (GROQ_KEY) return chatGroq(messages)
  return chatOllama(messages)
}

async function chatGroq(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.6, max_tokens: 400 }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`Groq API ${res.status}: ${err.slice(0, 200)}`)
  }
  const data: any = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || "Sorry, I could not generate a reply."
}

async function chatOllama(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false, options: { temperature: 0.6, num_predict: 400 } }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data: any = await res.json()
  return data?.message?.content?.trim() || "Sorry, I could not generate a reply."
}
