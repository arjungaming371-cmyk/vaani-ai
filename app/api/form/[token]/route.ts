import { NextRequest, NextResponse } from "next/server"
import { db, query } from "@/lib/db"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { sendApplicationConfirmation, isMailConfigured } from "@/lib/mail"

// PUBLIC endpoint (no login) — protected by rate limiting + one-time tokens.

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!rateLimit(`form-get:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const linkRes = await query(`SELECT * FROM form_links WHERE token = $1`, [token])
  const link = linkRes.rows[0]
  if (!link) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })

  const { data: lead } = await db.from("leads").select("*").eq("id", link.lead_id).single()
  return NextResponse.json({
    valid: true,
    used: !!link.used_at,
    lead: lead ? { name: lead.name, phone: lead.phone, address: lead.address, product_interest: lead.product_interest } : null,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Rate limit by IP and by token (blocks both spray and single-link abuse)
  if (!rateLimit(`form-post:${clientIp(req)}`, 10, 60_000) || !rateLimit(`form-post-token:${token}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const linkRes = await query(`SELECT * FROM form_links WHERE token = $1`, [token])
  const link = linkRes.rows[0]
  if (!link) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 })

  // ONE-TIME LINK: a used token can never be submitted again.
  if (link.used_at) {
    return NextResponse.json({ error: "This application link has already been used." }, { status: 410 })
  }

  const body = await req.json()
  const {
    student_name,
    city,
    email,
    address,
    whatsapp_number,
    course_interest,
    campus_preference,
    twelfth_group,
    twelfth_percentage,
    passing_year,
    parent_name,
    parent_phone,
    ...rest
  } = body

  if (!student_name) return NextResponse.json({ error: "student_name required" }, { status: 400 })

  try {
    // ATOMIC claim: only ONE request can flip used_at from NULL.
    // A second concurrent submit gets rowCount 0 and is rejected.
    const claim = await query(
      `UPDATE form_links SET used_at = now() WHERE token = $1 AND used_at IS NULL RETURNING token`,
      [token]
    )
    if (claim.rowCount === 0) {
      return NextResponse.json({ error: "This application link has already been used." }, { status: 410 })
    }

    const { data: app, error } = await db
      .from("admission_applications")
      .insert({
        lead_id: link.lead_id,
        student_name,
        city,
        email,
        address,
        whatsapp_number,
        course_interest: course_interest || "AI & ML",
        campus_preference,
        twelfth_group,
        twelfth_percentage: twelfth_percentage ? Number(twelfth_percentage) : null,
        passing_year,
        parent_name,
        parent_phone,
        form_data: JSON.stringify(rest),
        submitted_at: new Date().toISOString(),
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      // Insert failed — release the token so the customer can retry.
      await query(`UPDATE form_links SET used_at = NULL WHERE token = $1`, [token]).catch(() => {})
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (link.lead_id) {
      await db
        .from("leads")
        .update({ form_completed: true, status: "qualified", updated_at: new Date().toISOString() })
        .eq("id", link.lead_id)
    }

    // Email confirmation — fire-and-forget, never blocks the response.
    if (email && isMailConfigured()) {
      sendApplicationConfirmation({
        to: email,
        name: student_name,
        loanType: course_interest || "B.Tech CSE",
        applicationId: app?.id || token,
      })
        .then((r) => {
          if (r.ok && link.lead_id) {
            return query(
              `INSERT INTO comm_logs (lead_id, type, summary, outcome) VALUES ($1, 'email', $2, 'sent')`,
              [link.lead_id, `Application confirmation emailed to ${email}`]
            )
          }
        })
        .catch((e) => console.error("confirmation email error:", e.message))
    }

    return NextResponse.json(app)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
