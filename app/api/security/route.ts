import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const { data: settings } = await db.from("security_settings").select("key, enabled")
  const { data: logs } = await db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20)
  return NextResponse.json({ settings: settings ?? [], logs: logs ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { key, enabled } = await req.json()
  if (key === "_action") return NextResponse.json({ ok: true })
  await db.from("security_settings").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key)
  await db.from("audit_log").insert({ action: `${key} ${enabled ? "enabled" : "disabled"}`, details: "Changed via dashboard" })
  return NextResponse.json({ ok: true })
}
