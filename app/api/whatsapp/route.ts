import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { chatWithOllama, detectLanguage, type Language } from "@/lib/ollama"
import { sendWhatsAppText } from "@/lib/whatsapp"
import { getVoiceContext } from "@/lib/memory"

export const dynamic = "force-dynamic"

// Inbound WhatsApp webhook — fed by our self-hosted service
// (server/whatsapp-service.js). Receives { from, text, waMessageId, profileName }.
//
// Robust design:
// 1. Lead is matched by LAST 10 DIGITS — works no matter how the phone
//    was saved: "98xxxxxx90", "+9198xxxxxx90", "9198xxxxxx90".
// 2. The inbound message is ALWAYS saved first — even if AI fails.
// 3. AI reply runs in its own try/catch — an Ollama failure never
//    loses the customer's message.
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key")
  if (!key || key !== (process.env.WHATSAPP_SERVICE_KEY || "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const from = String(body?.from || "").replace(/\D/g, "")
  const text = String(body?.text || "").slice(0, 4000)
  const waMessageId = body?.waMessageId ? String(body.waMessageId) : null
  if (!from || !text) return NextResponse.json({ error: "from and text required" }, { status: 400 })

  const last10 = from.slice(-10)

  try {
    // ---- 1. Find lead by last 10 digits (handles every phone format) ----
    let lead: any = null
    const found = await query(
      `SELECT * FROM leads WHERE regexp_replace(phone, '\\D', '', 'g') LIKE '%' || $1 LIMIT 1`,
      [last10]
    )
    if (found.rows.length > 0) {
      lead = found.rows[0]
    } else {
      const created = await query(
        `INSERT INTO leads (name, phone, whatsapp_number, source, status)
         VALUES ($1, $2, $2, 'whatsapp', 'new') RETURNING *`,
        [body?.profileName || `WA ${last10}`, `+${from}`]
      )
      lead = created.rows[0]
    }

    // ---- 2. ALWAYS save the inbound message first ----
    await query(
      `INSERT INTO whatsapp_messages (lead_id, wa_message_id, phone_number, direction, content, status)
       VALUES ($1, $2, $3, 'inbound', $4, 'received')`,
      [lead.id, waMessageId, `+${from}`, text]
    ).catch(() =>
      query(
        `INSERT INTO whatsapp_messages (lead_id, wa_message_id, direction, content, status)
         VALUES ($1, $2, 'inbound', $3, 'received')`,
        [lead.id, waMessageId, text]
      )
    )

    // ---- 3. AI auto-reply (isolated — failure never loses the message) ----
    let aiReply: string | null = null
    try {
      const lang = detectLanguage(text) as Language
      const historyRes = await query(
        `SELECT role, content FROM ai_conversations WHERE lead_id = $1 ORDER BY created_at ASC LIMIT 15`,
        [lead.id]
      )
      const messages = [
        ...historyRes.rows.map((h: any) => ({ role: h.role as "user" | "model", content: h.content })),
        { role: "user" as const, content: text },
      ]

      // CROSS-CHANNEL MEMORY: if this lead recently spoke to Vaani on a call,
      // brief the WhatsApp AI so the conversation continues seamlessly.
      // Only on the first few messages — keeps regular chats fast.
      let voiceContext: string | undefined
      if (historyRes.rows.length <= 2) {
        voiceContext = (await getVoiceContext(lead.id)) || undefined
      }

      aiReply = await chatWithOllama(messages, lang, voiceContext)

      await query(
        `INSERT INTO ai_conversations (lead_id, role, content, language) VALUES ($1, 'user', $2, $3), ($1, 'model', $4, $3)`,
        [lead.id, text, lang, aiReply]
      ).catch(() => {})
    } catch (e: any) {
      console.error("AI reply failed (message still saved):", e.message)
    }

    // ---- 4. Send the reply if AI produced one ----
    if (aiReply) {
      const sent = await sendWhatsAppText(from, aiReply)
      await query(
        `INSERT INTO whatsapp_messages (lead_id, phone_number, direction, content, status)
         VALUES ($1, $2, 'outbound', $3, $4)`,
        [lead.id, `+${from}`, aiReply, sent.ok ? "sent" : "failed"]
      ).catch(() =>
        query(
          `INSERT INTO whatsapp_messages (lead_id, direction, content, status) VALUES ($1, 'outbound', $2, $3)`,
          [lead.id, aiReply, sent.ok ? "sent" : "failed"]
        )
      )
      await query(
        `INSERT INTO comm_logs (lead_id, type, summary, outcome) VALUES ($1, 'whatsapp', $2, $3)`,
        [lead.id, `WA: "${text.slice(0, 60)}" → AI replied`, sent.ok ? "replied" : "reply_failed"]
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, replied: !!aiReply })
  } catch (e: any) {
    console.error("whatsapp inbound error:", e.message)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
