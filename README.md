# 🎙️ Vaani AI — The AI Agent That Answers Every Business Enquiry

**Takeover Hackathon 2026 · Theme 2: AI Automation & Intelligent Agents + Theme 3: Customer Acquisition & Lead Conversion**

> SMEs lose more than half their enquiries because nobody follows up in time. Vaani answers every phone call and WhatsApp message **instantly, in the customer's own language** (Telugu · Hindi · English), qualifies the lead, and never forgets a follow-up — self-hosted, so it costs less than one telecaller's chai budget.

---

## 🎥 Demo

**Watch the 2-minute demo:** [DEMO VIDEO LINK HERE]

What you'll see: a real phone call answered by Vaani in Telugu → the lead appearing live on the dashboard → an automatic WhatsApp follow-up with a booking link → the owner's view of the full conversation across BOTH channels.

## 😖 The Problem (from the official problem statements)

- *"Businesses cannot provide instant responses to customer queries, resulting in delayed support and reduced customer satisfaction."* — Theme 2
- *"Businesses lose potential customers because enquiries are not followed up efficiently or converted into sales."* — Theme 3

A typical Indian SME — a clinic, a coaching centre, a real-estate office — gets 50–300 enquiries a month. The owner is busy serving customers; calls go unanswered, WhatsApp messages pile up, and every silent hour makes the lead colder. Hiring telecallers costs ₹15–25K/month per person, and they still only work 8 hours in one or two languages.

## 💡 The Solution

Vaani is an **autonomous AI agent** that becomes the business's front desk:

1. **Answers voice calls** — real-time STT → LLM → TTS pipeline speaks naturally in Telugu, Hindi, or English, detected automatically.
2. **Replies on WhatsApp instantly** — official Meta Cloud API, replies are free inside the service window.
3. **Qualifies every lead** — asks the right questions for the business type (configurable script), extracts name/need/budget, and scores intent.
4. **Never drops a follow-up** — sends booking/application links, schedules reminders, escalates hot leads to the owner.
5. **Cross-channel memory** — if a customer calls and then messages on WhatsApp, Vaani remembers both conversations as one relationship.

**Configurable per business:** the same agent runs a clinic ("book an appointment"), a coaching centre ("admission enquiry"), or a real-estate office ("site visit booking") — just by editing the script in the dashboard. No code changes.

## 🏗️ Architecture

```
  Customer                      Vaani Server (self-hosted)
 ┌─────────┐   voice   ┌────────────────────────────────────────┐
 │  Phone  │──────────▶│ Telephony webhook → Whisper STT        │
 └─────────┘           │        ↓                               │
 ┌─────────┐  message  │ Ollama (Llama 3.1 8B) ← script config  │
 │WhatsApp │──────────▶│        ↓                    ↑          │
 └─────────┘           │ TTS / WhatsApp reply   PostgreSQL      │
                       │        ↓                (leads, memory)│
                       │ Next.js dashboard (owner's view)       │
                       └────────────────────────────────────────┘
```

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🔒 Why self-hosted AI matters

The LLM (Ollama + Llama 3.1), speech recognition (Whisper), and database all run on the business's own machine. **Customer names, phone numbers, and conversations never leave the server** — no per-token API bills, no data sent to foreign AI providers. Total running cost: electricity + ~₹0.115 per WhatsApp template message.

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend & Dashboard | Next.js 15 + TypeScript |
| AI Brain | Ollama · Llama 3.1 8B (self-hosted) |
| Speech-to-Text | OpenAI Whisper (self-hosted) |
| Text-to-Speech | Neural TTS (Telugu/Hindi/English voices) |
| Database | PostgreSQL |
| Telephony | Exotel webhooks |
| WhatsApp | Meta WhatsApp Business Cloud API (official) |
| Tunnel / HTTPS | Cloudflare Tunnel |

## 🚀 Quick Start

```bash
git clone <this repo> && cd vaani
cp .env.example .env          # fill in the values
npm install
node scripts/setup-db.js      # creates PostgreSQL schema + demo data
npm run dev                   # dashboard at http://localhost:3000
```

Requirements: Node 20+, PostgreSQL 15+, Ollama with `llama3.1:8b` pulled, Python 3.10+ for the Whisper service.

## 📈 Impact & Business Model

- **For the SME:** every enquiry answered in <3 seconds, 24×7, in 3 languages, at ~1/20th the cost of one telecaller.
- **Market:** 63 million MSMEs in India; even the smallest slice that gets phone/WhatsApp enquiries is millions of businesses.
- **Model:** one-time setup + small monthly AMC; runs on a mini-PC in the shop or one cloud VM.

## 👥 Team

[TEAM MEMBER NAMES + ROLES HERE]

## 📄 Docs

- [Architecture deep-dive](docs/ARCHITECTURE.md)
- [Demo script & test flow](docs/DEMO.md)
- [Pitch one-pager](docs/PITCH.md)
