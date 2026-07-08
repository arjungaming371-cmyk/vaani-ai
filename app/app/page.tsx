import Link from "next/link"

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#141428", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 56 }}>🎙️</div>
      <h1 style={{ fontSize: 44, margin: "10px 0 6px", letterSpacing: 2 }}>VAANI AI</h1>
      <p style={{ color: "#CADCFC", fontSize: 17, maxWidth: 560, lineHeight: 1.5 }}>
        The AI front-desk that answers every business enquiry — by voice and WhatsApp, in Telugu, Hindi, and English. Instantly. Always.
      </p>
      <div style={{ display: "flex", gap: 14, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/simulator" style={{ background: "#F5A623", color: "#141428", padding: "14px 30px", borderRadius: 14, fontWeight: 800, fontSize: 16, textDecoration: "none" }}>
          Talk to Vaani →
        </Link>
        <Link href="/demo" style={{ border: "1px solid #F5A623", color: "#F5A623", padding: "14px 30px", borderRadius: 14, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
          View dashboard →
        </Link>
      </div>
      <p style={{ color: "#8B8BA7", fontSize: 13, marginTop: 26, maxWidth: 540 }}>
        Takeover Hackathon 2026 · Theme 2: AI Automation & Intelligent Agents.
        In production, Vaani runs fully self-hosted (Ollama · Llama 3.1 8B + Whisper) and answers real phone calls and WhatsApp via the official Meta Cloud API.
      </p>
    </main>
  )
}
