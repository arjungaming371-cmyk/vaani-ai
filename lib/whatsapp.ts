// Self-hosted WhatsApp — NO Meta Cloud API, NO Twilio.
//
// Messages are sent through our own local WhatsApp service
// (server/whatsapp-service.js, powered by whatsapp-web.js) which runs a real
// WhatsApp Web session on the VPS. Every message is also logged to our local
// PostgreSQL (whatsapp_messages table) by the service.
//
// Setup (one time):
//   cd server && npm install && node whatsapp-service.js
//   → scan the QR code with the business WhatsApp phone. Done.
//
// Env:
//   WHATSAPP_SERVICE_URL  (default http://localhost:3001)
//   WHATSAPP_SERVICE_KEY  shared secret between Next.js and the service

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3001"
const SERVICE_KEY = process.env.WHATSAPP_SERVICE_KEY || ""

/** Normalize an Indian number to digits with country code: 98765 43210 → 919876543210 */
function normalizeNumber(to: string): string {
  let digits = to.replace(/\D/g, "")
  if (digits.length === 10) digits = "91" + digits
  if (digits.length === 12 && digits.startsWith("0")) digits = "91" + digits.slice(2)
  return digits
}

export async function sendWhatsAppText(
  to: string,
  message: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const number = normalizeNumber(to)
  if (number.length < 11) return { ok: false, error: `Invalid number: ${to}` }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(`${SERVICE_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
      signal: controller.signal,
      body: JSON.stringify({ to: number, message }),
    })
    clearTimeout(timeoutId)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, id: data.id }
  } catch (e: any) {
    return { ok: false, error: `WhatsApp service unreachable: ${e.message}` }
  }
}

/**
 * Sends the B.Tech admission application link after a call collects the student's details.
 * APPLICATION_FORM_URL in .env can override the base (defaults to this app's own /form page).
 */
export async function sendApplicationLink(to: string, name: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const formBase = process.env.APPLICATION_FORM_URL || `${appUrl}/form`
  const link = `${formBase.replace(/\/$/, "")}/${token}`
  const message = `Hi ${name}! Thanks for speaking with Vaani from Vaani AI. 🎓\n\nComplete your B.Tech application here: ${link}\n\nNext step after applying: the NAT (Vaani Admission-Counselling Test) — our counsellor will guide you.\n\nWe never ask for OTP, PIN, or any payment on calls. — Vaani AI`
  return sendWhatsAppText(to, message)
}

/** Health check for the dashboard / /api/security page. */
export async function checkWhatsAppHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${SERVICE_URL}/health`, { headers: { "x-api-key": SERVICE_KEY } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, message: `Service HTTP ${res.status}` }
    return { ok: !!data.ready, message: data.ready ? "WhatsApp connected" : "WhatsApp not ready — scan QR in service logs" }
  } catch (e: any) {
    return { ok: false, message: `WhatsApp service not running: ${e.message}` }
  }
}
