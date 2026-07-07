import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function checkOllama(): Promise<boolean> {
  try {
    const url = process.env.OLLAMA_URL || "http://localhost:11434"
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch { return false }
}

export async function GET() {
  const waUrl = process.env.WHATSAPP_SERVICE_URL || "http://127.0.0.1:3001"
  const waKey = process.env.WHATSAPP_SERVICE_KEY || ""

  const [waHealth, ollama] = await Promise.all([
    fetch(`${waUrl}/health`, { headers: { "x-api-key": waKey }, signal: AbortSignal.timeout(2000) })
      .then(r => r.json()).catch(() => ({ ok: false, ready: false })),
    checkOllama(),
  ])

  return NextResponse.json({
    whatsapp: { running: !!waHealth.ok, connected: !!waHealth.ready },
    ollama:   { running: ollama },
    website:  { running: true },
  })
}
