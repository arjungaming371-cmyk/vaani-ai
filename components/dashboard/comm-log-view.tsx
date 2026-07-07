"use client"
import { useEffect, useState } from "react"
import { timeAgo } from "@/lib/utils"

type CallLog  = { id:string; lead_name:string; phone:string; duration:string; time:string; status:string; transcript:{role:string;text:string}[] }
type WALog    = { id:string; type:string; lead_name:string; content:string; time:string; status:string }

export default function CommLogView() {
  const [calls, setCalls]     = useState<any[]>([])
  const [waLogs, setWaLogs]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string|null>(null)

  async function load() {
    setLoading(true)
    const [c,w] = await Promise.all([
      fetch("/api/calls").then(r=>r.ok?r.json():[]),
      fetch("/api/comms").then(r=>r.ok?r.json():[]),
    ])
    setCalls(c)
    setWaLogs(w.filter((l:any)=>l.type==="whatsapp"))
    setLoading(false)
  }

  useEffect(() => { load(); const t=setInterval(load,15000); return ()=>clearInterval(t) }, [])

  const STATUS_STYLE: Record<string,{bg:string;color:string;icon:string}> = {
    completed: {bg:"rgba(34,197,94,0.15)",  color:"#4ade80", icon:"✅"},
    failed:    {bg:"rgba(239,68,68,0.15)",   color:"#f87171", icon:"❌"},
    initiated: {bg:"rgba(59,130,246,0.15)",  color:"#60a5fa", icon:"🔄"},
    "in-progress":{bg:"rgba(245,158,11,0.15)",color:"#fbbf24",icon:"📞"},
    sent:      {bg:"rgba(34,197,94,0.15)",   color:"#4ade80", icon:"✅"},
    replied:   {bg:"rgba(59,130,246,0.15)",  color:"#60a5fa", icon:"↩"},
  }

  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,height:"calc(100vh-160px)" }}>
      {/* Auto Calls */}
      <div style={{ background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:18 }}>📞</span>
            <div style={{ fontWeight:600,fontSize:15 }}>Recent Auto-Calls</div>
          </div>
          <span style={{ background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:6,padding:"3px 10px",fontSize:12,color:"var(--text-muted)" }}>{calls.length} calls</span>
        </div>
        <div style={{ flex:1,overflowY:"auto" }}>
          {loading && <div style={{ padding:30,textAlign:"center",color:"var(--text-muted)" }}>Loading...</div>}
          {!loading && calls.length===0 && <div style={{ padding:30,textAlign:"center",color:"var(--text-muted)",fontSize:13 }}>No calls yet. Trigger an AI call from Voice Logs.</div>}
          {calls.map(call => {
            const st = STATUS_STYLE[call.status]??STATUS_STYLE.initiated
            const transcript = Array.isArray(call.transcript) ? call.transcript : []
            const name = call.leads?.name || call.phone || "Unknown"
            const num  = call.leads?.phone || call.phone || ""
            const callTime = new Date(call.created_at).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})
            const durStr = call.duration ? `${Math.floor(call.duration/60)}:${(call.duration%60).toString().padStart(2,"0")}` : "0:00"
            return (
              <div key={call.id} style={{ padding:"16px 20px",borderBottom:"1px solid var(--border-light)" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:transcript.length>0?12:0,cursor:"pointer" }} onClick={()=>setExpanded(expanded===call.id?null:call.id)}>
                  <div>
                    <div style={{ fontWeight:600,fontSize:14 }}>{name}</div>
                    <div style={{ fontSize:12,color:"var(--text-muted)",marginTop:2 }}>{num} · {callTime}</div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:13,fontFamily:"monospace",color:"var(--text-secondary)" }}>{durStr}</span>
                    <span style={{ background:st.bg,color:st.color,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600 }}>{st.icon} {call.status}</span>
                  </div>
                </div>
                {expanded===call.id && transcript.length>0 && (
                  <div style={{ background:"var(--bg-secondary)",borderRadius:8,padding:14,marginTop:8 }}>
                    {transcript.map((t:any,i:number)=>(
                      <div key={i} style={{ display:"flex",gap:8,marginBottom:8 }}>
                        <span style={{ fontSize:18,flexShrink:0 }}>{t.role==="ai"?"🤖":"👤"}</span>
                        <div>
                          <span style={{ fontSize:11,fontWeight:700,color:t.role==="ai"?"#60a5fa":"var(--text-muted)",marginRight:6,textTransform:"uppercase" }}>{t.role==="ai"?"AI":"CUSTOMER"}</span>
                          <span style={{ fontSize:13,color:"var(--text-secondary)" }}>{t.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* WhatsApp Automation */}
      <div style={{ background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:18 }}>💬</span>
            <div style={{ fontWeight:600,fontSize:15 }}>WhatsApp Automation</div>
          </div>
          <span style={{ background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:6,padding:"3px 10px",fontSize:12,color:"var(--text-muted)" }}>Auto-replies</span>
        </div>
        <div style={{ flex:1,overflowY:"auto" }}>
          {loading && <div style={{ padding:30,textAlign:"center",color:"var(--text-muted)" }}>Loading...</div>}
          {!loading && waLogs.length===0 && <div style={{ padding:30,textAlign:"center",color:"var(--text-muted)",fontSize:13 }}>No WhatsApp automation logs yet.</div>}
          {waLogs.map(log => {
            const st = STATUS_STYLE[log.outcome]??STATUS_STYLE.sent
            return (
              <div key={log.id} style={{ padding:"16px 20px",borderBottom:"1px solid var(--border-light)" }}>
                {log.type && <div style={{ fontSize:11,color:"var(--text-muted)",marginBottom:6,display:"flex",alignItems:"center",gap:6 }}>⚡ {log.type}</div>}
                <div style={{ background:"#2563eb",borderRadius:12,borderBottomLeftRadius:4,padding:"10px 14px",marginBottom:8,display:"inline-block",maxWidth:"85%" }}>
                  <div style={{ fontSize:13,color:"white" }}>{log.summary}</div>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div style={{ fontSize:12,color:"var(--text-muted)" }}>{log.leads?.name || "System"}</div>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <span style={{ background:st.bg,color:st.color,borderRadius:6,padding:"3px 8px",fontSize:11 }}>{st.icon} {log.outcome}</span>
                    <span style={{ fontSize:11,color:"var(--text-muted)" }}>{new Date(log.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
