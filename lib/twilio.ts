// Twilio outbound calls — PRIMARY provider for Vaani AI.
// The call connects to our voicebot via Twilio Media Streams (WebSocket),
// where ElevenLabs speaks as Vaani and self-hosted Whisper listens.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ""
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ""
const CALLER_ID = process.env.TWILIO_CALLER_ID || "" // your Twilio number, E.164: +1..., +91...
const PUBLIC_WSS_URL = process.env.VOICEBOT_PUBLIC_WSS_URL || "" // wss://your-domain/voicebot-twilio

export function isTwilioConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && CALLER_ID && PUBLIC_WSS_URL)
}

/**
 * Start an outbound call. TwiML <Connect><Stream> pipes the live audio to our
 * voicebot server; leadId + language ride along as stream parameters.
 */
export async function makeTwilioCall(
  phone: string,
  leadId: string,
  language: string
): Promise<{ sid: string }> {
  if (!isTwilioConfigured()) {
    throw new Error(
      "Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CALLER_ID, VOICEBOT_PUBLIC_WSS_URL in .env"
    )
  }

  const to = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${PUBLIC_WSS_URL}">
      <Parameter name="leadId" value="${leadId}" />
      <Parameter name="language" value="${language}" />
    </Stream>
  </Connect>
</Response>`

  const params = new URLSearchParams({
    To: to,
    From: CALLER_ID,
    Twiml: twiml,
    // Status callbacks keep voice_calls in sync (answered / completed / failed)
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? {
          StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/status`,
          StatusCallbackEvent: "answered completed",
          StatusCallbackMethod: "POST",
        }
      : {}),
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Twilio call failed HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  if (!data?.sid) throw new Error("Twilio returned no call SID")
  return { sid: data.sid }
}
