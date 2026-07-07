// NIAT Admissions — self-hosted WhatsApp service (no Meta API, no Twilio).
//
// Runs a real WhatsApp Web session via whatsapp-web.js. The Next.js app
// (lib/whatsapp.ts) calls this over localhost. Every outgoing and incoming
// message is logged to local PostgreSQL (whatsapp_messages table).
//
// First run:
//   cd server && npm install
//   node whatsapp-service.js
//   → a QR code prints in the terminal. Scan it with the business phone's
//     WhatsApp (Linked devices → Link a device). Session persists in
//     ./.wwebjs_auth so you only scan once.
//
// Production: run under pm2 →  pm2 start whatsapp-service.js --name whatsapp

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })

const express = require("express")
const qrcode = require("qrcode-terminal")
const QRCode = require("qrcode")
const { Client, LocalAuth } = require("whatsapp-web.js")
const { Pool } = require("pg")

const PORT = parseInt(process.env.WHATSAPP_SERVICE_PORT || "3001")
const API_KEY = process.env.WHATSAPP_SERVICE_KEY || ""

if (!API_KEY) {
  console.error("FATAL: WHATSAPP_SERVICE_KEY is not set in .env — refusing to start without auth.")
  process.exit(1)
}

const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: parseInt(process.env.PG_PORT || "5432"),
  database: process.env.PG_DATABASE || "niat_admissions",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "",
  max: 5,
})

async function logMessage(direction, number, message, status, waId) {
  try {
    await pool.query(
      `INSERT INTO whatsapp_messages (direction, phone_number, content, status, wa_message_id) VALUES ($1,$2,$3,$4,$5)`,
      [direction, number, message, status, waId || null]
    )
  } catch (e) {
    console.error("DB log error:", e.message)
  }
}

// Forward inbound customer messages to the Next.js app, which handles the
// lead record, the Ollama auto-reply, and all logging.
// Always forward inbound messages to the LOCAL app — never the public URL.
// (Cloudflare tunnel URLs change on restart and would silently break this.)
const APP_URL = process.env.APP_INTERNAL_URL || "http://127.0.0.1:3000"
async function forwardInbound(msg) {
  const from = (msg.from || "").replace("@c.us", "")
  console.log(`📩 Inbound from ${from}: "${(msg.body || "").slice(0, 50)}"`)
  try {
    const contact = await msg.getContact().catch(() => null)
    const res = await fetch(`${APP_URL}/api/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        from,
        text: msg.body || "",
        waMessageId: msg.id?._serialized || null,
        profileName: contact?.pushname || null,
      }),
    })
    if (res.ok) {
      console.log(`   ✅ Forwarded to app — AI reply processing`)
    } else {
      const err = await res.text().catch(() => "")
      console.error(`   ❌ App rejected message: HTTP ${res.status} ${err.slice(0, 100)}`)
    }
  } catch (e) {
    console.error(`   ❌ Cannot reach app at ${APP_URL} — is the website running? (${e.message})`)
  }
}

let ready = false
let currentQR = null
let qrDataUrl = null
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: __dirname + "/.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  },
})

client.on("qr", async (qr) => {
  console.log("\nScan this QR with the business WhatsApp (Linked devices):\n")
  qrcode.generate(qr, { small: true })
  currentQR = qr
  try { qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 }) } catch {}
})
client.on("ready", () => {
  ready = true
  currentQR = null
  qrDataUrl = null
  console.log("✅ WhatsApp connected and ready.")
})
client.on("disconnected", (reason) => {
  ready = false
  console.error("WhatsApp disconnected:", reason)
  // whatsapp-web.js will not auto-reconnect after logout; try re-init.
  setTimeout(() => client.initialize().catch(() => {}), 5000)
})
client.on("auth_failure", (msg) => console.error("Auth failure:", msg))

// Every inbound customer message → Next.js app (lead + AI auto-reply + logging).
client.on("message", (msg) => {
  if (msg.from?.endsWith("@c.us")) forwardInbound(msg)
})

client.initialize().catch((e) => console.error("init error:", e))

const app = express()
app.use(express.json({ limit: "100kb" }))

// Constant-time-ish API key check on every request.
app.use((req, res, next) => {
  const key = req.headers["x-api-key"]
  if (!key || key !== API_KEY) return res.status(401).json({ ok: false, error: "unauthorized" })
  next()
})

app.get("/health", (_req, res) => res.json({ ok: true, ready }))

app.get("/qr", (_req, res) => {
  if (ready) return res.json({ ok: true, ready: true, qr: null })
  if (!qrDataUrl) return res.json({ ok: true, ready: false, qr: null, message: "QR not generated yet, please wait..." })
  res.json({ ok: true, ready: false, qr: qrDataUrl })
})

app.post("/send", async (req, res) => {
  const { to, message } = req.body || {}
  if (!to || !message) return res.status(400).json({ ok: false, error: "to and message required" })
  if (!ready) {
    await logMessage("outbound", to, message, "failed_not_ready", null)
    return res.status(503).json({ ok: false, error: "WhatsApp not ready — scan QR first" })
  }
  const digits = String(to).replace(/\D/g, "")
  if (digits.length < 11 || digits.length > 15) {
    return res.status(400).json({ ok: false, error: `invalid number: ${to}` })
  }
  try {
    const chatId = `${digits}@c.us`
    const registered = await client.isRegisteredUser(chatId)
    if (!registered) {
      await logMessage("outbound", digits, message, "failed_not_on_whatsapp", null)
      return res.status(404).json({ ok: false, error: "number not on WhatsApp" })
    }
    const sent = await client.sendMessage(chatId, String(message))
    await logMessage("outbound", digits, message, "sent", sent.id?._serialized)
    res.json({ ok: true, id: sent.id?._serialized })
  } catch (e) {
    await logMessage("outbound", digits, message, "failed", null)
    console.error("send error:", e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.listen(PORT, "127.0.0.1", () => console.log(`WhatsApp service on http://127.0.0.1:${PORT} (localhost only)`))
