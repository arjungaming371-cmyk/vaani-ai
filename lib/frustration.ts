// Frustration detection — the cheap, reliable version.
//
// Strategy: a fast multilingual keyword pass runs on EVERY customer turn
// (zero latency added to the call). When it trips, the call is flagged
// asynchronously: voice_calls.sentiment → "Frustrated" and a comm_log entry
// appears so a human can jump in from the dashboard. The call itself is
// never slowed down — flagging happens fire-and-forget after the reply.

import { db, query } from "./db"

// English / Hindi / Telugu frustration & escalation markers.
// Deliberately conservative — false positives annoy operators.
const FRUSTRATION_RE = new RegExp(
  [
    // English
    "stop calling", "don'?t call", "how many times", "again and again", "fed up",
    "wasting my time", "waste of time", "not interested at all", "leave me alone",
    "irritating", "annoy", "scam", "fraud", "fake call", "harass", "complain",
    "report you", "shut up", "listen to me",
    // Hindi
    "परेशान", "बार बार", "कितनी बार", "तंग", "बकवास", "फ्रॉड", "धोखा",
    "समय बर्बाद", "फोन मत", "कॉल मत", "शिकायत",
    // Telugu
    "విసిగి", "ఎన్నిసార్లు", "మళ్ళీ మళ్ళీ", "ఫోన్ చేయవద్దు", "కాల్ చేయవద్దు",
    "మోసం", "ఫ్రాడ్", "టైమ్ వేస్ట్", "కంప్లైంట్",
  ].join("|"),
  "i"
)

// Repeated short negative replies also signal trouble ("no." "no!" "NO")
const HARD_NO_RE = /^(no+|nahi+|nahin|వద్దు|లేదు|नहीं)[.!\s]*$/i

export function detectFrustration(speech: string, history: { role: string; content: string }[]): boolean {
  if (FRUSTRATION_RE.test(speech)) return true
  // Three hard "no"s in the recent customer turns = flag it
  const recentUser = history.filter((m) => m.role === "user").slice(-3)
  const hardNos = [...recentUser.map((m) => m.content), speech].filter((t) => HARD_NO_RE.test(t.trim()))
  return hardNos.length >= 3
}

/** Fire-and-forget: mark the call + surface it on the dashboard. Never blocks the call. */
export function flagFrustratedCall(callSid: string | null, leadId: string | null, speech: string): void {
  ;(async () => {
    try {
      if (callSid) {
        await db.from("voice_calls").update({ sentiment: "Frustrated", outcome: "needs_human" }).eq("twilio_call_sid", callSid)
      }
      await query(
        `INSERT INTO comm_logs (lead_id, type, summary, outcome)
         VALUES ($1, 'alert', $2, 'needs_human')`,
        [leadId, `⚠️ FRUSTRATED CALLER — said: "${speech.slice(0, 120)}" — consider a human callback`]
      )
    } catch (e: any) {
      console.error("flagFrustratedCall error:", e.message)
    }
  })()
}
