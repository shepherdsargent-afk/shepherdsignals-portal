import { NextResponse } from 'next/server'

const EDGE_BASE = 'https://lmrgzsfvzzdoatpddjvb.supabase.co/functions/v1'
const ADMIN_KEY = 'shepherd-admin-2024'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const RESEND_KEY = process.env.RESEND_API_KEY
    if (!RESEND_KEY) return NextResponse.json({ error: 'Resend not configured' }, { status: 500 })

    // Get magic link from Edge Function
    const linkRes = await fetch(`${EDGE_BASE}/get-magic-link`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirect_to: 'https://portal.shepherdsignals.com/auth/callback' }),
    })
    const linkData = await linkRes.json()
    if (!linkData.magic_link) {
      return NextResponse.json({ error: 'Could not generate magic link' }, { status: 500 })
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#071a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;margin:8px 0 4px;font-size:22px;font-weight:800;">ShepherdSignals</h1>
      <p style="color:#4ade80;margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Procurement Intelligence</p>
    </div>
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;padding:32px;text-align:center;">
      <h2 style="color:#ffffff;margin:0 0 12px;font-size:20px;font-weight:700;">Log in to your portal</h2>
      <p style="color:#9ca3af;margin:0 0 28px;font-size:14px;line-height:1.6;">Click the button below to securely access your Golf World procurement dashboard.</p>
      <a href="${linkData.magic_link}" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;">Log Into Portal</a>
      <p style="color:#4b5563;font-size:12px;margin:20px 0 0;">Link expires in 1 hour. Do not share this email.</p>
    </div>
  </div>
</body>
</html>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ShepherdSignals <signals@shepherdsignals.com>',
        to: email,
        subject: 'Your ShepherdSignals Login Link',
        html,
      }),
    })
    const emailData = await emailRes.json()
    if (emailData.error) return NextResponse.json({ error: emailData.error }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}