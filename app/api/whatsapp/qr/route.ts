import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || "http://127.0.0.1:3001"
  const serviceKey = process.env.WHATSAPP_SERVICE_KEY || ""
  try {
    const res = await fetch(`${serviceUrl}/qr`, {
      headers: { "x-api-key": serviceKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json({ qr: null, ready: false })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ qr: null, ready: false, error: "Service not running" })
  }
}
