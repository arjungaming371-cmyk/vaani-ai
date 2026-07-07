// Call provider switch — TWILIO is the primary provider for Vaani.
// Exotel remains available as an optional fallback: set CALL_PROVIDER=exotel.

import { makeTwilioCall, isTwilioConfigured } from "./twilio"
import { makeCall as makeExotelCall } from "./exotel"

export type CallProvider = "twilio" | "exotel"

export function activeProvider(): CallProvider {
  const p = (process.env.CALL_PROVIDER || "twilio").toLowerCase()
  return p === "exotel" ? "exotel" : "twilio"
}

export async function makeCall(phone: string, leadId: string, language: string, instructions?: string): Promise<{ sid: string; provider: CallProvider }> {
  const provider = activeProvider()
  if (provider === "exotel") {
    const call = await makeExotelCall(phone, leadId, language, instructions)
    return { sid: call.sid, provider }
  }
  if (!isTwilioConfigured()) {
    throw new Error("CALL_PROVIDER=twilio but Twilio is not configured — fill the TWILIO_* vars in .env (or set CALL_PROVIDER=exotel)")
  }
  const call = await makeTwilioCall(phone, leadId, language)
  return { sid: call.sid, provider }
}
