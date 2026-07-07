"use client"
import { useEffect, useState } from "react"
import { formatCurrency, timeAgo } from "@/lib/utils"

// TODO: replace with the real loan types from rightagentgroupe.com once available
const LOAN_TYPES = ["AI & ML", "Data Science", "Full Stack Development", "Not sure yet"]  // specialisation interests

type Lead = {
  id: string; name: string; phone: string; address: string; whatsapp_number: string
  product_interest: string; status: string; interested: string; loan_amount: number
  call_count: number; created_at: string; updated_at: string
}

const INTERESTED_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  interested:     { bg: "rgba(34,197,94,0.15)",  color: "#4ade80", label: "Interested" },
  not_interested: { bg: "rgba(239,68,68,0.15)",  color: "#f87171", label: "Not Interested" },
  unknown:        { bg: "rgba(100,116,139,0.15)",color: "#94a3b8", label: "Unknown" },
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  const colors = ["#1d4ed8", "#7c3aed", "#0891b2", "#047857", "#b45309"]
  const color = colors[(name || "?").charCodeAt(0) % colors.length]
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export default function LeadsView() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [ageFilter, setAgeFilter] = useState("all")
  const [amountFilter, setAmountFilter] = useState("all")
  const [loanTypeFilter, setLoanTypeFilter] = useState("all")
  const [interestedFilter, setInterestedFilter] = useState("all")

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", address: "", product_interest: "AI & ML", loan_amount: "", language: "english" })

  const [callTarget, setCallTarget] = useState<Lead | null>(null)
  const [callInstructions, setCallInstructions] = useState("")
  const [calling, setCalling] = useState<string | null>(null)

  const [waTarget, setWaTarget] = useState<Lead | null>(null)
  const [waText, setWaText] = useState("")
  const [waSending, setWaSending] = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (ageFilter !== "all") params.set("age", ageFilter)
    if (amountFilter !== "all") params.set("amount", amountFilter)
    if (loanTypeFilter !== "all") params.set("loanType", loanTypeFilter)
    if (interestedFilter !== "all") params.set("interested", interestedFilter)
    const res = await fetch(`/api/leads?${params.toString()}`)
    if (res.ok) setLeads(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [search, ageFilter, amountFilter, loanTypeFilter, interestedFilter])

  const totalLeads = leads.length
  const qualified = leads.filter((l) => l.status === "qualified").length
  // Pipeline value = sum of loan_amount only where it's a valid positive number
  const pipelineValue = leads.reduce((s, l) => {
    const amt = Number(l.loan_amount)
    return s + (isFinite(amt) && amt > 0 ? amt : 0)
  }, 0)
  const interestedCount = leads.filter((l) => l.interested === "interested").length

  async function startCall() {
    if (!callTarget) return
    setCalling(callTarget.id)
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: callTarget.id, phone: callTarget.phone, language: "english", instructions: callInstructions }),
    })
    const data = await res.json()
    setCalling(null)
    setCallTarget(null)
    setCallInstructions("")
    if (res.ok) load()
    else alert(`❌ ${data.error}`)
  }

  async function sendWa() {
    if (!waTarget || !waText.trim()) return
    setWaSending(true)
    const to = waTarget.whatsapp_number || waTarget.phone
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message: waText, leadId: waTarget.id }),
    })
    const data = await res.json()
    setWaSending(false)
    if (res.ok) { setWaTarget(null); setWaText("") }
    else alert(data.error === "WHATSAPP_NOT_CONFIGURED" ? data.message : `❌ ${data.error}`)
  }

  async function addLead() {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, loan_amount: form.loan_amount ? parseFloat(form.loan_amount) : null, source: "manual" }),
    })
    if (res.ok) { setShowAdd(false); load() }
  }

  const Card = ({ label, value, icon }: any) => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
        </div>
        <div style={{ width: 44, height: 44, background: "rgba(59,130,246,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
      </div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
        <Card label="Total Leads" value={totalLeads.toLocaleString()} icon="👥" />
        <Card label="Interested" value={interestedCount.toLocaleString()} icon="🎯" />
        <Card label="Pipeline Value" value={formatCurrency(pipelineValue)} icon="💰" />
        <Card label="Qualified" value={qualified.toLocaleString()} icon="✅" />
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          {/* Single compact filter row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              placeholder="🔍 Search name/phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 180, height: 34, fontSize: 12 }}
            />
            <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} style={{ height: 34, fontSize: 12, width: 110 }}>
              <option value="all">All Ages</option>
              <option value="new">New (7d)</option>
              <option value="old">Older</option>
            </select>
            <select value={amountFilter} onChange={(e) => setAmountFilter(e.target.value)} style={{ height: 34, fontSize: 12, width: 130 }}>
              <option value="all">All Amounts</option>
              <option value="high">High (≥ ₹10L)</option>
              <option value="low">Low (&lt; ₹10L)</option>
            </select>
            <select value={loanTypeFilter} onChange={(e) => setLoanTypeFilter(e.target.value)} style={{ height: 34, fontSize: 12, width: 140 }}>
              <option value="all">All Specialisations</option>
              {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={interestedFilter} onChange={(e) => setInterestedFilter(e.target.value)} style={{ height: 34, fontSize: 12, width: 130 }}>
              <option value="all">All Statuses</option>
              <option value="interested">Interested</option>
              <option value="not_interested">Not Interested</option>
              <option value="unknown">Unknown</option>
            </select>
            {/* Refresh — resets all filters and reloads */}
            <button
              onClick={() => {
                setSearch("")
                setAgeFilter("all")
                setAmountFilter("all")
                setLoanTypeFilter("all")
                setInterestedFilter("all")
              }}
              title="Reset filters"
              style={{ height: 34, width: 34, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >↻</button>
            {/* Spacer */}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{leads.length} shown</div>
            <button
              onClick={() => setShowAdd(true)}
              style={{ height: 34, background: "#1d4ed8", color: "white", border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
            >+ Add Lead</button>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["LEAD", "ADDRESS", "COURSE", "12TH %", "STATUS", "CALLS", "UPDATED", "ACTIONS"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No leads match these filters.</td></tr>
            )}
            {leads.map((lead) => {
              const ist = INTERESTED_STYLES[lead.interested] ?? INTERESTED_STYLES.unknown
              return (
                <tr key={lead.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={lead.name} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{lead.name || "Unknown"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{lead.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontSize: 13, maxWidth: 200 }}>{lead.address || "—"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: "rgba(59,130,246,0.12)", color: "var(--text-secondary)", borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>{lead.product_interest || "—"}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 13 }}>{lead.loan_amount ? formatCurrency(lead.loan_amount) : "—"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: ist.bg, color: ist.color, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{ist.label}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{lead.call_count ?? 0}</td>
                  <td style={{ padding: "14px 16px", color: "var(--text-muted)", fontSize: 12 }}>{timeAgo(lead.updated_at || lead.created_at)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setCallTarget(lead); setCallInstructions("") }}
                        disabled={!lead.phone || calling === lead.id}
                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "6px 10px", fontSize: 13, opacity: calling === lead.id ? 0.5 : 1 }}
                      >📞</button>
                      <button
                        onClick={() => setWaTarget(lead)}
                        disabled={!lead.phone && !lead.whatsapp_number}
                        style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
                      >💬</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add Lead modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Add New Lead</div>
            {[["name", "Full Name *"], ["phone", "Phone *"], ["address", "Address"], ["loan_amount", "Amount (₹)"]].map(([k, l]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{l}</label>
                <input value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>Loan Type</label>
              <select value={form.product_interest} onChange={(e) => setForm({ ...form, product_interest: e.target.value })}>
                {LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={addLead} disabled={!form.name || !form.phone} style={{ flex: 1, padding: 10, background: "#1d4ed8", border: "none", borderRadius: 8, color: "white", fontWeight: 600, opacity: form.name && form.phone ? 1 : 0.5 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Call instructions modal */}
      {callTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 460 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Call {callTarget.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{callTarget.phone}</div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>What should Vaani talk about? (optional)</label>
            <textarea
              value={callInstructions}
              onChange={(e) => setCallInstructions(e.target.value)}
              placeholder="e.g. Follow up on his home loan enquiry, mention the 8.4% rate offer"
              rows={4}
              style={{ width: "100%", background: "#0d1422", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 8, padding: 10, fontSize: 13, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setCallTarget(null)} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={startCall} disabled={calling === callTarget.id} style={{ flex: 1, padding: 10, background: "#1d4ed8", border: "none", borderRadius: 8, color: "white", fontWeight: 600, opacity: calling === callTarget.id ? 0.5 : 1 }}>
                {calling === callTarget.id ? "Calling…" : "📞 Start Call"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp quick message modal */}
      {waTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Message {waTarget.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{waTarget.whatsapp_number || waTarget.phone}</div>
            <textarea
              value={waText}
              onChange={(e) => setWaText(e.target.value)}
              placeholder="Type a WhatsApp message…"
              rows={4}
              style={{ width: "100%", background: "#0d1422", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 8, padding: 10, fontSize: 13, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setWaTarget(null)} style={{ flex: 1, padding: 10, background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={sendWa} disabled={waSending || !waText.trim()} style={{ flex: 1, padding: 10, background: "#22c55e", border: "none", borderRadius: 8, color: "white", fontWeight: 600, opacity: waSending || !waText.trim() ? 0.5 : 1 }}>
                {waSending ? "Sending…" : "💬 Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
