import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://127.0.0.1:3001"
  const serviceKey = process.env.WHATSAPP_SERVICE_KEY || ""
  try {
    const res  = await fetch(`${serviceUrl}/health`, {
      headers: { "x-api-key": serviceKey },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return NextResponse.json({ configured: true, ready: false, message: "Service error" })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ configured: true, ready: !!data.ready, message: data.ready ? "WhatsApp connected" : "Scan QR first" })
  } catch {
    return NextResponse.json({ configured: true, ready: false, message: "Service not running" })
  }
}
