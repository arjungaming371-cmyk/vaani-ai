"use client"

import { useEffect, useRef, useState } from "react"

type Msg = { role: "user" | "assistant"; content: string }

const BUSINESSES = [
  { id: "clinic", label: "🦷 Lakshmi Dental Clinic" },
  { id: "coaching", label: "📚 Sunrise Coaching Centre" },
  { id: "realestate", label: "🏠 Sri Sai Properties" },
]

const GREETING: Record<string, string> = {
  clinic: "Namaste! Lakshmi Dental Clinic లోకి స్వాగతం. I'm Vaani — how can I help you today? మీరు తెలుగులో కూడా మాట్లాడవచ్చు!",
  coaching: "Hello! Welcome to Sunrise Coaching Centre. I'm Vaani — ask me about our SSC, Banking, or Railway batches. हिंदी या తెలుగు में भी पूछ सकते हैं!",
  realestate: "Namaste! Sri Sai Properties కి స్వాగతం. I'm Vaani — looking for a flat or a plot? Tell me your budget and area!",
}

export default function Simulator() {
  const [businessType, setBusinessType] = useState("clinic")
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING.clinic }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [provider, setProvider] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, busy])

  function switchBusiness(id: string) {
    setBusinessType(id)
    setMessages([{ role: "assistant", content: GREETING[id] }])
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    const next: Msg[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, messages: next }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }])
        if (data.provider) setProvider(data.provider)
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "Something went wrong — try again." }])
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network hiccup — please try again." }])
    }
    setBusy(false)
  }

  return (
    <main style={{ minHeight: "100vh", background: "#141428", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>
            🎙️ Vaani <span style={{ color: "#F5A623" }}>Simulator</span>
          </div>
          <div style={{ color: "#8B8BA7", fontSize: 14, marginTop: 4 }}>
            Talk to the AI front-desk. Try Telugu, Hindi, or English — ask prices, timings, book something.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
          {BUSINESSES.map((b) => (
            <button key={b.id} onClick={() => switchBusiness(b.id)}
              style={{
                padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600,
                border: businessType === b.id ? "2px solid #F5A623" : "1px solid #33334d",
                background: businessType === b.id ? "#F5A623" : "#1E1E3A",
                color: businessType === b.id ? "#141428" : "#CADCFC",
              }}>
              {b.label}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", color: "#8B8BA7", fontSize: 12, marginBottom: 10 }}>
          Same agent, different business — the script changes, not the code.
        </div>

        <div style={{ background: "#1E1E3A", borderRadius: 16, padding: 16, height: "52vh", overflowY: "auto", border: "1px solid #2a2a45" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
              <div style={{
                maxWidth: "80%", padding: "10px 14px", borderRadius: 14, fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "#F5A623" : "#2A2A48",
                color: m.role === "user" ? "#141428" : "#EDEDF7",
                borderBottomRightRadius: m.role === "user" ? 4 : 14,
                borderBottomLeftRadius: m.role === "user" ? 14 : 4,
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div style={{ color: "#8B8BA7", fontSize: 13, fontStyle: "italic" }}>Vaani is typing…</div>}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder='Try: "రేపు అపాయింట్మెంట్ కావాలి" or "What are your timings?"'
            style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid #33334d", background: "#1E1E3A", color: "#fff", fontSize: 14.5, outline: "none" }}
          />
          <button onClick={send} disabled={busy}
            style={{ padding: "12px 22px", borderRadius: 12, border: "none", background: busy ? "#7a5a1a" : "#F5A623", color: "#141428", fontWeight: 800, fontSize: 14.5, cursor: busy ? "wait" : "pointer" }}>
            Send
          </button>
        </div>

        <div style={{ textAlign: "center", color: "#55556f", fontSize: 11.5, marginTop: 10 }}>
          {provider ? `LLM: ${provider} · ` : ""}In production Vaani also answers real phone calls (Whisper STT + TTS) and WhatsApp via the official Meta Cloud API.
        </div>
      </div>
    </main>
  )
}
