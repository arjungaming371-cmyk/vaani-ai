import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateLeadSummary } from "@/lib/ollama"

export async function POST(req: NextRequest) {
  try {
    // Exotel sends JSON (StatusCallbackContentType=application/json);
    // form-encoded is kept as a fallback for older configurations.
    let callSid = "", callStatus = "", duration = 0
    let recordingUrl: string | null = null
    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body: any = await req.json().catch(() => ({}))
      callSid      = body.CallSid ?? body.call_sid ?? ""
      callStatus   = (body.Status ?? body.CallStatus ?? body.status ?? "").toLowerCase()
      duration     = parseInt(String(body.ConversationDuration ?? body.CallDuration ?? body.duration ?? "0")) || 0
      recordingUrl = body.RecordingUrl ?? body.recording_url ?? null
    } else {
      const fd = await req.formData()
      callSid      = (fd.get("CallSid") as string) ?? ""
      callStatus   = ((fd.get("CallStatus") as string) ?? "").toLowerCase()
      duration     = parseInt((fd.get("CallDuration") as string) ?? "0") || 0
      recordingUrl = fd.get("RecordingUrl") as string | null
    }

    console.log(`Call: ${callSid} | Status: ${callStatus} | Duration: ${duration}s`)
    if (!callSid) return new NextResponse("OK", { status: 200 })

    const outcomeMap: Record<string, string> = {
      completed: "resolved", busy: "missed", "no-answer": "missed", failed: "failed", canceled: "missed",
    }
    const outcome = outcomeMap[callStatus] ?? callStatus

    const { data: call, error: callError } = await db.from("voice_calls")
      .update({ status: callStatus, outcome, duration, recording_url: recordingUrl ?? null })
      .eq("twilio_call_sid", callSid)
      .select()
      .single()

    if (callError) { console.error("update error:", callError); return new NextResponse("OK", { status: 200 }) }
    if (!call?.lead_id) return new NextResponse("OK", { status: 200 })

    const transcript = Array.isArray(call.transcript) ? call.transcript
      : (typeof call.transcript === "string" ? JSON.parse(call.transcript) : [])
    const allText = transcript.map((t: any) => t.text ?? "").join(" ").toLowerCase()

    const positiveWords = /yes\b|interested|please|confirm|okay|ok\b|sure|good|great/
    const negativeWords = /\bno\b|not interested|busy|later|cancel|dont|nope/
    const sentiment = negativeWords.test(allText) ? "Negative" : positiveWords.test(allText) ? "Positive" : "Neutral"

    await db.from("voice_calls").update({ sentiment }).eq("twilio_call_sid", callSid)
    await db.from("leads").update({
      status: sentiment === "Positive" ? "qualified" : "contacted",
      updated_at: new Date().toISOString(),
    }).eq("id", call.lead_id)

    if (callStatus === "completed" && transcript.length > 0) {
      const transcriptText = transcript.map((t: any) => `${t.role === "ai" ? "Vaani" : "Customer"}: ${t.text}`).join("\n")
      try {
        const summary = await generateLeadSummary(transcriptText)
        await db.from("voice_calls").update({ ai_summary: summary }).eq("twilio_call_sid", callSid)
      } catch (e) { console.error("summary error:", e) }

      await db.from("comm_logs").insert({
        lead_id: call.lead_id,
        type: "call",
        summary: `AI call completed (${duration}s). Sentiment: ${sentiment}. ${transcript.length} exchanges.`,
        outcome,
      })
    }

    return new NextResponse("OK", { status: 200 })
  } catch (e) {
    console.error("Unexpected:", e)
    return new NextResponse("OK", { status: 200 })
  }
}
