import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  // Verify cron secret
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  // Get all active companies on daily or both plan
  const { data: companies } = await supabase
    .from('companies')
    .select('*, company_users(users:user_id(email))')
    .in('plan', ['daily', 'both'])
    .eq('status', 'active')

  if (!companies?.length) {
    return NextResponse.json({ message: 'No companies to email' })
  }

  const results = []

  for (const company of companies) {
    // Get today's price alerts (last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: alerts } = await supabase
      .from('price_alerts')
      .select('*, products(name), vendors(name)')
      .eq('company_id', company.id)
      .gte('created_at', since)
      .order('change_pct', { ascending: false })

    // Get contact email
    const contactEmail = company.contact_email
    if (!contactEmail) continue

    const hasAlerts = alerts && alerts.length > 0
    const ups = alerts?.filter((a: any) => a.change_direction === 'up') ?? []
    const downs = alerts?.filter((a: any) => a.change_direction === 'down') ?? []

    const html = buildDailyEmail(company.name, alerts ?? [], ups, downs)
    const subject = hasAlerts
      ? `📊 ${alerts!.length} price change${alerts!.length > 1 ? 's' : ''} flagged — ${company.name}`
      : `✅ No price changes today — ${company.name}`

    try {
      const { data: emailData } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'signals@shepherdsignals.com',
        to: contactEmail,
        subject,
        html,
      })

      await supabase.from('email_log').insert({
        company_id: company.id,
        email_type: 'daily_signal',
        recipient_email: contactEmail,
        subject,
        resend_id: emailData?.id,
        status: 'sent',
      })

      results.push({ company: company.name, status: 'sent', alerts: alerts?.length ?? 0 })
    } catch (err: any) {
      results.push({ company: company.name, status: 'failed', error: err.message })
    }
  }

  return NextResponse.json({ results })
}

function buildDailyEmail(companyName: string, alerts: any[], ups: any[], downs: any[]) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const alertRows = alerts.length > 0 ? alerts.map(a => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;">${a.products?.name ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#9ca3af;">${a.vendors?.name ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;">$${a.old_price?.toFixed(2) ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;font-weight:600;color:${a.change_direction === 'up' ? '#f87171' : '#4ade80'};">
        $${a.new_price?.toFixed(2) ?? '—'} (${a.change_direction === 'up' ? '+' : ''}${a.change_pct?.toFixed(1)}%)
      </td>
    </tr>
  `).join('') : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#6b7280;">No price changes detected in the last 24 hours</td></tr>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a1f18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:24px;">🐑</span>
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">ShepherdSignals</span>
      </div>
      <p style="color:#6b7280;margin:0;font-size:14px;">Daily Price Signal — ${date}</p>
    </div>

    <!-- Greeting -->
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;padding:24px;margin-bottom:20px;">
      <h2 style="color:#ffffff;margin:0 0 8px;font-size:18px;">${companyName}</h2>
      <p style="color:#9ca3af;margin:0;font-size:14px;line-height:1.6;">
        ${alerts.length > 0
          ? `We detected <strong style="color:#ffffff;">${alerts.length} price change${alerts.length > 1 ? 's' : ''}</strong> from your vendors in the last 24 hours.
             ${ups.length > 0 ? `<strong style="color:#f87171;">${ups.length} price increase${ups.length > 1 ? 's' : ''}</strong>` : ''}
             ${ups.length > 0 && downs.length > 0 ? ' and ' : ''}
             ${downs.length > 0 ? `<strong style="color:#4ade80;">${downs.length} decrease${downs.length > 1 ? 's' : ''}</strong>` : ''} detected.`
          : 'All clear — no price changes detected from your vendors today. We\'ll keep watching.'
        }
      </p>
    </div>

    ${alerts.length > 0 ? `
    <!-- Alerts Table -->
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid #1a4a3a;">
        <h3 style="color:#ffffff;margin:0;font-size:15px;">Price Changes</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0a1f18;">
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Product</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Vendor</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Previous</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">New Price</th>
          </tr>
        </thead>
        <tbody style="color:#e5e7eb;">${alertRows}</tbody>
      </table>
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.shepherdsignals.com'}/dashboard/alerts"
         style="background:#1a4a3a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;color:#374151;font-size:12px;">
      ShepherdSignals · <a href="mailto:shepherdsargent@shepherdsignals.com" style="color:#374151;">shepherdsargent@shepherdsignals.com</a>
      <br>You're receiving this because you're subscribed to daily price signals.
    </p>
  </div>
</body>
</html>`
}
