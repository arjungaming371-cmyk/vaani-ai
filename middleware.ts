import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

// Paths that MUST stay public:
// - /login + /api/auth/*          → the login flow itself
// - /api/calls/*, /api/tts/*      → telephony webhooks
// - /form/*, /api/form/*          → the customer-facing loan form
// - /api/whatsapp (POST inbound)  → WhatsApp service webhook (key-protected)
// - /api/warmup                   → cron warmup
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/calls/",
  "/api/tts",
  "/form/",
  "/api/form/",
  "/api/warmup",
  "/simulator",
]

// EXACT matches only — subroutes stay session-protected.
const PUBLIC_EXACT = ["/", "/api/whatsapp", "/api/chat"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  // APIs get 401 JSON; pages get redirected to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const loginUrl = new URL("/login", req.url)
  loginUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map)$).*)"],
}
