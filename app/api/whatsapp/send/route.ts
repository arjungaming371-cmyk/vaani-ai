import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendWhatsAppText } from "@/lib/whatsapp"

export async function POST(req: NextRequest) {
  const { to, message, leadId } = await req.json()
  if (!to || !message) return NextResponse.json({ error: "to and message required" }, { status: 400 })

  const result = await sendWhatsAppText(to, message)
  if (!result.ok) {
    if (result.error === "WHATSAPP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "WHATSAPP_NOT_CONFIGURED", message: "WhatsApp service is not running or WHATSAPP_SERVICE_KEY is not set. Start it: node server/whatsapp-service.js and scan the QR." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  await db.from("whatsapp_messages").insert({ lead_id: leadId ?? null, phone_number: to, direction: "outbound", content: message, status: "sent" }).catch(() => {})
  if (leadId) {
    await db.from("comm_logs").insert({ lead_id: leadId, type: "whatsapp", summary: message.slice(0, 140), outcome: "sent" }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
