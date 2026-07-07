import { NextRequest, NextResponse } from "next/server"
import { chat, providerName, type ChatMessage } from "@/lib/llm"

export const dynamic = "force-dynamic"

// Demo business presets — proves "one agent, any business" (change script, not code).
const PRESETS: Record<string, { name: string; script: string }> = {
  clinic: {
    name: "Lakshmi Dental Clinic",
    script: `You are Vaani, the friendly AI receptionist of Lakshmi Dental Clinic, Hyderabad.
Services: general dentistry, root canal (Rs 4000-7000), braces consultation (free first visit), cleaning (Rs 1200). Timings: Mon-Sat 10am-8pm.
Your goals: greet warmly, answer questions about services/prices/timings, and book appointments by collecting the patient's name and preferred day/time.
When a booking is agreed, confirm it clearly and say a WhatsApp confirmation with the clinic location will be sent.`,
  },
  coaching: {
    name: "Sunrise Coaching Centre",
    script: `You are Vaani, the admissions assistant of Sunrise Coaching Centre, Hyderabad (SSC, Banking, and Railway exam coaching).
Batches: morning 7-10am, evening 6-9pm. Fee: Rs 15,000 for 6 months, installments available. Free demo class every Monday.
Your goals: answer course/fee/batch questions, invite the student to the free Monday demo class, and collect their name and phone-number-confirmation for a seat.`,
  },
  realestate: {
    name: "Sri Sai Properties",
    script: `You are Vaani, the enquiry assistant of Sri Sai Properties, Hyderabad (2/3 BHK flats and open plots in Kompally and Shamshabad).
Flats: Rs 45L-85L. Plots: Rs 12,000-18,000 per sq yard. Site visits available every day with free pickup.
Your goals: understand the customer's budget and preferred area, answer questions, and book a site visit by collecting their name and preferred day.`,
  },
}

const COMMON_RULES = `
Language rule: reply in the SAME language the customer uses — Telugu, Hindi, or English. If they write Telugu in English letters (transliteration), reply the same way.
Keep replies short and conversational (2-4 sentences), like a real receptionist on the phone.
Never invent services or prices not listed. If asked something you don't know, say you'll have the owner call them back.
Never ask for OTP, PIN, or any payment - and say so if payment safety comes up.
You are a DEMO for the Takeover Hackathon 2026; if asked whether you are an AI, answer honestly and proudly.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const businessType = typeof body?.businessType === "string" && PRESETS[body.businessType] ? body.businessType : "clinic"
    const history = Array.isArray(body?.messages) ? body.messages.slice(-14) : []
    const preset = PRESETS[businessType]

    const messages: ChatMessage[] = [
      { role: "system", content: preset.script + COMMON_RULES },
      ...history
        .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
    ]

    const reply = await chat(messages)
    return NextResponse.json({ reply, business: preset.name, provider: providerName() })
  } catch (e: any) {
    console.error("chat error:", e.message)
    return NextResponse.json({ error: "The AI is taking a coffee break — please try again in a moment." }, { status: 500 })
  }
}
