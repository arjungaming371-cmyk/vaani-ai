import { randomUUID } from "crypto"
import { db, query } from "./db"
import { chatWithOllama, extractLeadInfo, mightBeComplete, type Language } from "./ollama"
import { sendApplicationLink } from "./whatsapp"
import { getWhatsAppContext } from "./memory"
import { detectFrustration, flagFrustratedCall } from "./frustration"

// Permission-based opener — respect keeps people on the line.
export const GREETINGS: Record<Language, string> = {
  english:
    "Hello! This is Vaani calling from Vaani — Vaani AI. You had shown interest in our B.Tech program. This will take just one minute. May I know the student's full name, please?",
  hindi:
    "नमस्ते! मैं Vaani बोल रही हूं, Vaani — Vaani AI से। आपने हमारे B.Tech प्रोग्राम में रुचि दिखाई थी। सिर्फ एक मिनट लगेगा। कृपया स्टूडेंट का पूरा नाम बताएं?",
  telugu:
    "నమస్కారం! నేను Vaani, Vaani — Vaani AI నుండి మాట్లాడుతున్నాను. మీరు మా B.Tech ప్రోగ్రామ్‌పై ఆసక్తి చూపారు. ఒక్క నిమిషం చాలు. దయచేసి స్టూడెంట్ పూర్తి పేరు చెప్పండి?",
}

const CLOSING: Record<Language, string> = {
  english: "Thank you! I'm sending the application link and NAT test details to your WhatsApp right now. Our admissions counsellor will guide you through the next steps. All the best!",
  hindi: "धन्यवाद! मैं अभी आपके WhatsApp पर आवेदन लिंक और NAT टेस्ट की जानकारी भेज रही हूं। हमारे एडमिशन काउंसलर अगले स्टेप्स में आपकी मदद करेंगे। शुभकामनाएं!",
  telugu: "ధన్యవాదాలు! నేను ఇప్పుడు మీ WhatsApp కి అప్లికేషన్ లింక్ మరియు NAT టెస్ట్ వివరాలు పంపుతున్నాను. మా అడ్మిషన్ కౌన్సెలర్ తదుపరి దశల్లో మీకు సహాయం చేస్తారు. ఆల్ ది బెస్ట్!",
}

const RETRY_MSG: Record<Language, string> = {
  english: "Sorry, I had a small technical moment. Could you please share the student's name so I can send the application link?",
  hindi:   "माफ कीजिए, छोटी तकनीकी समस्या हुई। कृपया स्टूडेंट का नाम बताएं ताकि मैं आवेदन लिंक भेज सकूं।",
  telugu:  "క్షమించండి, చిన్న సాంకేతిక సమస్య వచ్చింది. దయచేసి స్టూడెంట్ పేరు చెప్పండి, అప్లికేషన్ లింక్ పంపుతాను.",
}

// FIXED: only real goodbye phrases end the call.
// Plain "thank you" / "धन्यवाद" / "ధన్యవాదాలు" must NOT hang up —
// Vaani says thanks naturally in the middle of a conversation.
const GOODBYE_RE =
  /goodbye|bye[- ]?bye|have a (great|good|nice) day|अलविदा|फिर मिलेंगे|दिन शुभ हो|వీడ్కోలు|సెలవు|మంచి రోజు జరగాలి/i

/** Called on the first webhook hit of a call (before any speech). Bumps call_count once per call. */
export async function startCall(leadId: string, callSid: string, language: Language): Promise<string> {
  if (leadId) {
    query(`UPDATE leads SET call_count = call_count + 1, last_called_at = now() WHERE id = $1`, [leadId]).catch((e) =>
      console.error("call_count update error:", e)
    )
  }
  if (callSid) {
    db.from("voice_calls")
      .upsert(
        {
          twilio_call_sid: callSid,
          lead_id: leadId || null,
          direction: "outbound",
          status: "in-progress",
          language,
          transcript: JSON.stringify([]),
        },
        { onConflict: "twilio_call_sid" }
      )
      .catch(() => {})
  }
  return GREETINGS[language]
}

async function getHistory(callSid: string): Promise<{ role: "user" | "model"; content: string }[]> {
  try {
    const { data } = await db.from("voice_calls").select("transcript").eq("twilio_call_sid", callSid).single()
    if (!data?.transcript) return []
    const transcript = typeof data.transcript === "string" ? JSON.parse(data.transcript) : data.transcript
    if (!Array.isArray(transcript)) return []
    return transcript
      .map((t: any) => ({ role: t.role === "ai" ? ("model" as const) : ("user" as const), content: t.text ?? "" }))
      .filter((m: any) => m.content)
  } catch {
    return []
  }
}

function updateTranscriptAsync(leadId: string | null, callSid: string | null, speech: string, reply: string): void {
  if (!callSid) return
  db.from("voice_calls")
    .select("transcript")
    .eq("twilio_call_sid", callSid)
    .single()
    .then(({ data: existing }: any) => {
      let prev: any[] = []
      if (existing?.transcript) prev = typeof existing.transcript === "string" ? JSON.parse(existing.transcript) : existing.transcript
      return db
        .from("voice_calls")
        .update({
          transcript: JSON.stringify([...prev, { role: "customer", text: speech }, { role: "ai", text: reply }]),
          status: "in-progress",
        })
        .eq("twilio_call_sid", callSid)
    })
    .catch((e: any) => console.error("transcript update error:", e))
}

export async function handleTurn(opts: {
  leadId: string
  callSid: string | null
  speech: string
  language: Language
  instructions?: string
}): Promise<{ text: string; hangup: boolean }> {
  const { leadId, callSid, speech, language, instructions } = opts

  const history = callSid ? await getHistory(callSid) : []
  const messages = [...history, { role: "user" as const, content: speech }]

  // FRUSTRATION RADAR: zero-latency keyword pass; flagging is fire-and-forget.
  if (detectFrustration(speech, history.map((h) => ({ role: h.role === "model" ? "model" : "user", content: h.content })))) {
    flagFrustratedCall(callSid, leadId || null, speech)
  }

  // CROSS-CHANNEL MEMORY: brief Vaani on this lead's recent WhatsApp chat
  // (only on the first couple of turns — keeps later prompts small & fast).
  let mergedInstructions = instructions || ""
  if (leadId && history.length <= 2) {
    const waContext = await getWhatsAppContext(leadId)
    if (waContext) mergedInstructions = [mergedInstructions, waContext].filter(Boolean).join("\n\n")
  }

  let reply = ""
  try {
    reply = (await chatWithOllama(messages, language, mergedInstructions || undefined)).trim()
    if (!reply) reply = GREETINGS[language]
  } catch (e) {
    console.error("Ollama error:", e)
    reply = RETRY_MSG[language]
  }

  updateTranscriptAsync(leadId || null, callSid, speech, reply)

  // SPEED FIX: a lead can only be complete once a WhatsApp number exists in
  // the transcript. Skip the second (expensive) Ollama extraction call until
  // a phone-number-like string actually appears — most turns stay at ONE
  // model call, which roughly halves per-turn latency.
  const allTurns = [...messages, { role: "model" as const, content: reply }]
  const transcriptText = allTurns.map((m) => `${m.role === "model" ? "Vaani" : "Customer"}: ${m.content}`).join("\n")

  if (mightBeComplete(transcriptText)) {
    const extracted = await extractLeadInfo(transcriptText)

    if (extracted.complete && leadId) {
      try {
        const updates: Record<string, any> = {
          status: "contacted",
          updated_at: new Date().toISOString(),
          interested: extracted.interested === true ? "interested" : extracted.interested === false ? "not_interested" : "unknown",
        }
        if (extracted.name) updates.name = extracted.name
        if (extracted.address) updates.address = extracted.address
        if (extracted.whatsapp_number) updates.whatsapp_number = extracted.whatsapp_number
        await db.from("leads").update(updates).eq("id", leadId)

        const token = randomUUID()
        await db.from("form_links").insert({ token, lead_id: leadId })

        const waNumber = extracted.whatsapp_number
        if (waNumber) {
          const result = await sendApplicationLink(waNumber, extracted.name || "there", token)
          if (!result.ok) console.error("WhatsApp link send failed:", result.error)
        }
      } catch (e) {
        console.error("lead completion error:", e)
      }
      return { text: CLOSING[language], hangup: true }
    }
  }

  return { text: reply, hangup: GOODBYE_RE.test(reply) }
}
