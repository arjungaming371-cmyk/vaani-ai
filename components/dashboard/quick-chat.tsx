"use client"
import { useState, useRef, useEffect } from "react"

type Message = { role: "user" | "assistant"; content: string }

const QUICK_COMMANDS = [
  { label: "How many leads today?", query: "How many new leads were added today?" },
  { label: "Pending calls", query: "How many calls are pending in the queue?" },
  { label: "Best performing language", query: "Which language has the most successful calls?" },
  { label: "Help", query: "What can you help me with on this dashboard?" },
]

export default function QuickChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm Vaani's assistant. Ask me quick questions about your leads, calls, or use commands like 'call John at +91...' to trigger actions." }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  async function send(text?: string) {
    const query = text ?? input
    if (!query.trim() || loading) return
    setInput("")
    const newMessages: Message[] = [...messages, { role: "user", content: query }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content,
      }))
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, language: "english", history }),
      })
      const data = await res.json()
      setMessages([...newMessages, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }])
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Please try again." }])
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: "none", color: "white",
          fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(59,130,246,0.4)", cursor: "pointer", zIndex: 999,
        }}
        title="Quick AI Assistant"
      >
        💬
      </button>
    )
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, width: 360, height: 480,
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column",
      zIndex: 999, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Quick Assistant</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Local AI · Always free</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "8px 12px", borderRadius: 10, fontSize: 13,
              background: msg.role === "user" ? "#2563eb" : "var(--bg-secondary)",
              color: msg.role === "user" ? "white" : "var(--text-primary)",
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "8px 12px", borderRadius: 10, background: "var(--bg-secondary)", display: "flex", gap: 4 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-muted)", animation: `bounce 1s ${i*0.15}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      {messages.length <= 1 && (
        <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_COMMANDS.map(c => (
            <button key={c.label} onClick={() => send(c.query)} style={{
              fontSize: 11, padding: "5px 10px", borderRadius: 14, background: "var(--bg-secondary)",
              border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer",
            }}>{c.label}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask anything or type a command…"
          style={{ flex: 1, fontSize: 13, height: 36 }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          width: 36, height: 36, borderRadius: 8, background: "#2563eb", border: "none",
          color: "white", fontSize: 16, opacity: (loading || !input.trim()) ? 0.5 : 1,
        }}>➤</button>
      </div>
      <style>{`@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
    </div>
  )
}
