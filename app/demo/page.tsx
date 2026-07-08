"use client"

import { useState } from "react"

// Standalone DEMO dashboard for judges — no login, no database.
// All data below is realistic sample data to showcase the real dashboard UI.

type ViewKey = "leads" | "whatsapp" | "voice" | "comms"

const LEADS = [
  { name: "Ramesh Kumar", phone: "+91 98765 43210", status: "Qualified", source: "Voice", score: 85, need: "Root canal, tomorrow morning" },
  { name: "Priya Sharma", phone: "+91 91234 56789", status: "Booked", source: "WhatsApp", score: 92, need: "Braces consultation" },
  { name: "Anita Reddy", phone: "+91 99887 76655", status: "New", source: "WhatsApp", score: 60, need: "Cleaning, asked prices" },
  { name: "Suresh Babu", phone: "+91 90000 12345", status: "Follow-up", source: "Voice", score: 70, need: "Wants evening slot" },
  { name: "Lakshmi Devi", phone: "+91 98111 22333", status: "Qualified", source: "WhatsApp", score: 78, need: "Toothache, urgent" },
]

const WA_CONVOS = [
  { name: "Priya Sharma", last: "Perfect, see you at 4 PM tomorrow!", time: "2:14 PM", unread: 0 },
  { name: "Anita Reddy", last: "What is the cost for cleaning?", time: "1:47 PM", unread: 2 },
  { name: "Lakshmi Devi", last: "నాకు రేపు అపాయింట్మెంట్ కావాలి", time: "12:30 PM", unread: 1 },
]

const WA_MESSAGES = [
  { dir: "in", text: "Hi, I saw your clinic on Google. Do you do braces?", time: "2:02 PM", status: "read" },
  { dir: "out", text: "Namaste! Yes, we offer braces consultation — the first visit is free. May I know your name?", time: "2:03 PM", status: "read" },
  { dir: "in", text: "Priya. How much are braces usually?", time: "2:05 PM", status: "read" },
  { dir: "out", text: "Nice to meet you, Priya! Braces vary by case, but the consultation is free and the dentist will give you an exact quote. Would you like to book a visit?", time: "2:06 PM", status: "read" },
  { dir: "in", text: "Yes, tomorrow evening if possible", time: "2:12 PM", status: "read" },
  { dir: "out", text: "Perfect, see you at 4 PM tomorrow! I'll send a confirmation with our location. We never ask for OTP or payment on chat. 😊", time: "2:14 PM", status: "delivered" },
]

const CALLS = [
  { name: "Ramesh Kumar", phone: "+91 98765 43210", lang: "Telugu", dur: "2:34", outcome: "Lead qualified — form sent", time: "Today 11:20 AM" },
  { name: "Suresh Babu", phone: "+91 90000 12345", lang: "Hindi", dur: "1:52", outcome: "Callback requested — evening", time: "Today 10:05 AM" },
  { name: "Unknown", phone: "+91 88776 65544", lang: "English", dur: "0:48", outcome: "Wrong number", time: "Yesterday 5:30 PM" },
  { name: "Lakshmi Devi", phone: "+91 98111 22333", lang: "Telugu", dur: "3:10", outcome: "Urgent — escalated to owner", time: "Yesterday 3:15 PM" },
]

const COMMS = [
  { type: "WhatsApp", who: "Priya Sharma", summary: "Booking confirmed for braces consult", outcome: "replied", time: "2:14 PM" },
  { type: "Voice", who: "Ramesh Kumar", summary: "Root canal enquiry, form link sent", outcome: "qualified", time: "11:20 AM" },
  { type: "WhatsApp", who: "Lakshmi Devi", summary: "Telugu appointment request", outcome: "AI replied", time: "12:30 PM" },
  { type: "Voice", who: "Suresh Babu", summary: "Evening slot callback", outcome: "follow-up", time: "10:05 AM" },
]

const NAV: { key: ViewKey; label: string; icon: string }[] = [
  { key: "leads", label: "Leads", icon: "👤" },
  { key: "whatsapp", label: "WhatsApp Chat", icon: "💬" },
  { key: "voice", label: "Voice Logs", icon: "📞" },
  { key: "comms", label: "Communication Log", icon: "📡" },
]

const C = {
  bg: "#0a0f1e", sidebar: "#0a0f1e", card: "#111827", cardHover: "#151e30",
  border: "#1e2d40", text: "#f1f5f9", sub: "#94a3b8", muted: "#64748b", amber: "#F5A623",
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const colors = ["#F5A623", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"]
  const c = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {name.charAt(0)}
    </div>
  )
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = { Qualified: "#3b82f6", Booked: "#10b981", New: "#64748b", "Follow-up": "#F5A623" }
  return <span style={{ fontSize: 12, fontWeight: 600, color: map[s] || "#64748b", background: `${map[s]}22`, padding: "3px 10px", borderRadius: 20 }}>{s}</span>
}

export default function DemoDashboard() {
  const [view, setView] = useState<ViewKey>("whatsapp")
  const [activeChat] = useState(0)

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <aside style={{ width: 260, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#141428" }}>V</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Vaani AI</div>
            <div style={{ fontSize: 11, color: C.muted }}>Owner Dashboard</div>
          </div>
        </div>
        <div style={{ padding: "16px 12px", flex: 1 }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 4, borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: view === n.key ? 700 : 500,
                background: view === n.key ? C.amber : "transparent", color: view === n.key ? "#141428" : C.sub }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
          🟢 Demo mode · sample data<br />Live AI: <a href="/simulator" style={{ color: C.amber }}>try the simulator →</a>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{NAV.find((n) => n.key === view)?.label}</div>
            <div style={{ fontSize: 13, color: C.sub }}>Demo dashboard with sample data — Lakshmi Dental Clinic</div>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>5</div><div style={{ color: C.muted }}>Leads</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>2</div><div style={{ color: C.muted }}>Booked</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6" }}>3</div><div style={{ color: C.muted }}>Unread</div></div>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {view === "leads" && (
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ background: "#0d1422", color: C.sub, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px" }}>Name</th><th>Phone</th><th>Source</th><th>Need</th><th>Score</th><th>Status</th>
                </tr></thead>
                <tbody>{LEADS.map((l, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{l.name}</td>
                    <td style={{ color: C.sub }}>{l.phone}</td>
                    <td><span style={{ fontSize: 12, color: l.source === "Voice" ? "#3b82f6" : "#10b981" }}>{l.source === "Voice" ? "📞 Voice" : "💬 WhatsApp"}</span></td>
                    <td style={{ color: C.sub, fontSize: 13 }}>{l.need}</td>
                    <td style={{ fontWeight: 700, color: l.score > 80 ? "#10b981" : l.score > 65 ? "#F5A623" : "#64748b" }}>{l.score}</td>
                    <td><StatusBadge s={l.status} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {view === "whatsapp" && (
            <div style={{ display: "flex", gap: 16, height: "70vh" }}>
              <div style={{ width: 300, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", flexShrink: 0 }}>
                {WA_CONVOS.map((c, i) => (
                  <div key={i} style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", background: i === activeChat ? C.cardHover : "transparent", cursor: "pointer" }}>
                    <Avatar name={c.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span><span style={{ fontSize: 11, color: C.muted }}>{c.time}</span></div>
                      <div style={{ fontSize: 13, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.last}</div>
                    </div>
                    {c.unread > 0 && <span style={{ background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 7px" }}>{c.unread}</span>}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, background: "#0b1420", borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name="Priya Sharma" size={36} /><div><div style={{ fontWeight: 600 }}>Priya Sharma</div><div style={{ fontSize: 12, color: "#10b981" }}>● answered by Vaani AI</div></div>
                </div>
                <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                  {WA_MESSAGES.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.dir === "out" ? "flex-end" : "flex-start", maxWidth: "72%", background: m.dir === "out" ? "#065f46" : C.card, color: m.dir === "out" ? "#e7fbf3" : C.text, padding: "9px 13px", borderRadius: 10, fontSize: 14, lineHeight: 1.4 }}>
                      {m.text}
                      <div style={{ fontSize: 10, color: m.dir === "out" ? "#8fd9c4" : C.muted, textAlign: "right", marginTop: 3 }}>
                        {m.time} {m.dir === "out" && <span style={{ color: m.status === "read" ? "#53bdeb" : "#a8b4c0" }}>✓✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, textAlign: "center" }}>
                  🤖 Vaani auto-replies to every message in the customer's language · official Meta Cloud API
                </div>
              </div>
            </div>
          )}

          {view === "voice" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CALLS.map((c, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 24 }}>📞</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{c.name} <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>{c.phone}</span></div>
                    <div style={{ fontSize: 13, color: C.sub }}>{c.outcome}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: C.muted }}>
                    <div><span style={{ color: C.amber }}>{c.lang}</span> · {c.dur}</div>
                    <div>{c.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "comms" && (
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ background: "#0d1422", color: C.sub, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px" }}>Channel</th><th>Contact</th><th>Summary</th><th>Outcome</th><th>Time</th>
                </tr></thead>
                <tbody>{COMMS.map((c, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 16px" }}><span style={{ color: c.type === "Voice" ? "#3b82f6" : "#10b981" }}>{c.type === "Voice" ? "📞" : "💬"} {c.type}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.who}</td>
                    <td style={{ color: C.sub }}>{c.summary}</td>
                    <td><span style={{ fontSize: 12, color: "#10b981" }}>{c.outcome}</span></td>
                    <td style={{ color: C.muted, fontSize: 13 }}>{c.time}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
