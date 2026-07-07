"use client"
import { useState, useEffect } from "react"
import LeadsView    from "./leads-view"
import ApplicationsView from "./applications-view"
import VoiceLogsView from "./voice-logs-view"
import WhatsAppView  from "./whatsapp-view"
import CommLogView   from "./comm-log-view"
import SecurityView  from "./security-view"
import UploadView    from "./upload-view"
import ScriptView    from "./script-view"
import QuickChat     from "./quick-chat"

export type ViewKey = "leads" | "loans" | "voice" | "whatsapp" | "comms" | "security" | "upload" | "script"

const NAV = [
  { key: "leads"    as ViewKey, label: "Leads",             icon: "👤" },
  { key: "loans"    as ViewKey, label: "Admission Applications", icon: "📄" },
  { key: "voice"    as ViewKey, label: "Voice Logs",        icon: "📞" },
  { key: "whatsapp" as ViewKey, label: "WhatsApp Chat",     icon: "💬" },
  { key: "comms"    as ViewKey, label: "Communication Log", icon: "📡" },
  { key: "security" as ViewKey, label: "Security Settings", icon: "🛡"  },
  { key: "upload"   as ViewKey, label: "Upload & Data",     icon: "📁" },
  { key: "script"   as ViewKey, label: "Vaani's Script",    icon: "📝" },
]

const VIEW_TITLES: Record<ViewKey, { title: string; sub: string }> = {
  leads:    { title: "Leads",              sub: "Pipeline and qualified prospects" },
  loans:    { title: "Admission Applications",  sub: "Submitted B.Tech admission applications" },
  voice:    { title: "Voice Logs",         sub: "Voice bot call activity and outcomes" },
  whatsapp: { title: "WhatsApp Chat",      sub: "Live customer conversations" },
  comms:    { title: "Communication Log",  sub: "Automated calls and WhatsApp activity" },
  security: { title: "Security Settings",  sub: "Access control and audit policy" },
  upload:   { title: "Upload & Data",      sub: "Upload contacts, scripts, and files for AI campaigns" },
  script:   { title: "Vaani's Script",     sub: "View and edit what Vaani says on every call" },
}

export default function DashboardShell() {
  const [view, setView] = useState<ViewKey>("leads")
  const [counts, setCounts] = useState({ leads: 0, loans: 0, whatsapp: 0 })
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    async function loadCounts() {
      try {
        const [l, lo, w] = await Promise.all([
          fetch("/api/leads?count=1").then(r => r.json()),
          fetch("/api/applications?count=1").then(r => r.json()),
          fetch("/api/whatsapp/unread").then(r => r.json()),
        ])
        setCounts({ leads: l.count ?? 0, loans: lo.count ?? 0, whatsapp: w.count ?? 0 })
      } catch {}
    }
    loadCounts()
    fetch("/api/auth/me").then(r => r.json()).then(d => setUserEmail(d.email || "")).catch(() => {})
    const t = setInterval(loadCounts, 30000)
    return () => clearInterval(t)
  }, [])

  const nav = NAV.map(n => ({
    ...n,
    badge: n.key === "leads" ? counts.leads : n.key === "loans" ? counts.loans : n.key === "whatsapp" ? counts.whatsapp : 0
  }))

  const { title, sub } = VIEW_TITLES[view]

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 280, flexShrink: 0, background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column"
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "white"
            }}>R</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Vaani AI</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Operations Console</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8, paddingLeft: 8 }}>
            WORKSPACE
          </div>
          {nav.map(({ key, label, icon, badge }) => (
            <button key={key} onClick={() => setView(key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, border: "none",
              background: view === key ? "rgba(59,130,246,0.15)" : "transparent",
              color: view === key ? "#60a5fa" : "var(--text-secondary)",
              fontWeight: view === key ? 600 : 400, cursor: "pointer",
              marginBottom: 2, textAlign: "left", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
              {badge > 0 && (
                <span style={{
                  background: "#3b82f6", color: "white", fontSize: 11,
                  fontWeight: 700, borderRadius: 10, padding: "1px 7px", minWidth: 20, textAlign: "center"
                }}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* User */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#1d4ed8", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0
          }}>RA</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Ops Administrator</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail || "..."}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: 64, borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)",
          display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
            <span style={{ fontSize: 14 }}>🎙</span>
            <span style={{ color: "var(--text-secondary)" }}>Voice Bot:</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <span style={{ color: "#22c55e", fontWeight: 600 }}>Online</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
            <span style={{ fontSize: 14 }}>💬</span>
            <span style={{ color: "var(--text-secondary)" }}>WhatsApp:</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <span style={{ color: "#22c55e", fontWeight: 600 }}>Active</span>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
            <input placeholder="Search..." style={{ paddingLeft: 32, width: 200, height: 36, fontSize: 13, borderRadius: 8 }} />
          </div>
          <button style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-secondary)", position: "relative" }}>
            🔔
            <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, background: "#ef4444", borderRadius: "50%", display: "block" }} />
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {view === "leads"    && <LeadsView />}
          {view === "loans"    && <ApplicationsView />}
          {view === "voice"    && <VoiceLogsView />}
          {view === "whatsapp" && <WhatsAppView />}
          {view === "comms"    && <CommLogView />}
          {view === "security" && <SecurityView />}
          {view === "upload"   && <UploadView />}
          {view === "script"   && <ScriptView />}
        </main>
      </div>
      <QuickChat />
    </div>
  )
}
