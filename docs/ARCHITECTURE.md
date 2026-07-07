# Vaani AI — Architecture

## Design principles
1. **Save first, think second.** Every inbound message/call turn is persisted BEFORE the AI runs. An AI failure can never lose a customer enquiry.
2. **Self-hosted intelligence.** LLM, STT, and DB run locally. Customer data never leaves the machine; marginal cost per conversation ≈ ₹0.
3. **One brain, many channels.** Voice and WhatsApp share the same lead record and conversation memory (cross-channel memory).
4. **Race-safe by construction.** Lead creation is serialized with PostgreSQL advisory locks; form links are single-use via atomic UPDATE...RETURNING claims.

## Voice pipeline (per call turn)
1. Telephony provider (Exotel) hits our webhook with caller audio.
2. Whisper STT (local Python service) transcribes; language auto-detected (te/hi/en).
3. Conversation history + business script + cross-channel context are assembled into the prompt.
4. Ollama (Llama 3.1 8B) generates the reply, behind a concurrency semaphore so parallel calls can't overload the model.
5. Neural TTS synthesizes the reply in the caller's language; audio returned to the telephony provider.
6. Turn transcript saved to PostgreSQL; intent/entities (name, need, budget) extracted and stored on the lead.

## WhatsApp pipeline
1. Meta Cloud API webhook delivers inbound messages (HMAC signature verified).
2. Message deduplicated by wa_message_id (Meta retries webhooks).
3. Lead found-or-created under an advisory lock keyed on the phone number.
4. Message saved; AI reply generated with shared conversation memory; reply sent via Graph API.
5. Delivery/read receipts update message status (dashboard shows ticks).

## Data model (core tables)
- leads (id, name, phone, source, status, score)
- ai_conversations (lead_id, role, content, language)
- whatsapp_messages (lead_id, wa_message_id, direction, content, status)
- voice_calls (lead_id, call_sid, transcript, duration, outcome)
- form_links (lead_id, token, used_at)  -- atomic one-time claim
- ai_scripts (business_type, language, content)  -- owner-editable agent behavior

## Security
- Dashboard behind OAuth; all API subroutes require a session (public exact-match webhooks only).
- Webhook authenticity: Meta HMAC-SHA256 signature; telephony webhook key.
- PII masked in logs; parameterized SQL everywhere; secrets only in .env.
