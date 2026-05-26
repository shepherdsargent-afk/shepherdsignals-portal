import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { format } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .in('plan', ['weekly', 'both'])
    .eq('status', 'active')

  if (!companies?.length) {
    return NextResponse.json({ message: 'No companies to email' })
  }

  const results = []
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const company of companies) {
    const contactEmail = company.contact_email
    if (!contactEmail) continue

    const [alertsRes, invoicesRes, alternativesRes] = await Promise.all([
      supabase.from('price_alerts')
        .select('*, products(name), vendors(name)')
        .eq('company_id', company.id)
        .gte('created_at', weekAgo)
        .order('change_pct', { ascending: false }),
      supabase.from('invoices')
        .select('*')
        .eq('company_id', company.id)
        .gte('created_at', weekAgo),
      supabase.from('vendor_alternatives')
        .select('*, products(name), current_vendor:vendors!vendor_alternatives_current_vendor_id_fkey(name), alternative_vendor:vendors!vendor_alternatives_alternative_vendor_id_fkey(name)')
        .eq('company_id', company.id)
        .order('savings_pct', { ascending: false })
        .limit(3),
    ])

    const alerts = alertsRes.data ?? []
    const invoices = invoicesRes.data ?? []
    const alternatives = alternativesRes.data ?? []
    const ups = alerts.filter((a: any) => a.change_direction === 'up')
    const downs = alerts.filter((a: any) => a.change_direction === 'down')

    const html = buildWeeklyEmail(company.name, alerts, ups, downs, invoices, alternatives)
    const subject = `📊 Weekly Audit — ${company.name} · ${format(new Date(), 'MMM d')}`

    try {
      const { data: emailData } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'signals@shepherdsignals.com',
        to: contactEmail,
        subject,
        html,
      })

      await supabase.from('email_log').insert({
        company_id: company.id,
        email_type: 'weekly_audit',
        recipient_email: contactEmail,
        subject,
        resend_id: emailData?.id,
        status: 'sent',
      })

      results.push({ company: company.name, status: 'sent' })
    } catch (err: any) {
      results.push({ company: company.name, status: 'failed', error: err.message })
    }
  }

  return NextResponse.json({ results })
}

function buildWeeklyEmail(company: string, alerts: any[], ups: any[], downs: any[], invoices: any[], alternatives: any[]) {
  const dateRange = `${format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'MMM d')} – ${format(new Date(), 'MMM d, yyyy')}`

  const topAlerts = alerts.slice(0, 5).map(a => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#e5e7eb;">${a.products?.name ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#9ca3af;">${a.vendors?.name ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;font-weight:600;color:${a.change_direction === 'up' ? '#f87171' : '#4ade80'};">
        ${a.change_direction === 'up' ? '▲' : '▼'} ${Math.abs(a.change_pct ?? 0).toFixed(1)}%
      </td>
    </tr>
  `).join('')

  const altRows = alternatives.slice(0, 3).map((a: any) => `
    <div style="background:#0a1f18;border:1px solid #1a4a3a;border-radius:8px;padding:14px;margin-bottom:10px;">
      <p style="color:#ffffff;margin:0 0 4px;font-size:14px;font-weight:600;">${(a.products as any)?.name}</p>
      <p style="color:#9ca3af;margin:0;font-size:13px;">
        Switch from <strong style="color:#e5e7eb;">${(a.current_vendor as any)?.name}</strong>
        to <strong style="color:#4ade80;">${(a.alternative_vendor as any)?.name}</strong>
        — save <strong style="color:#4ade80;">${a.savings_pct?.toFixed(1)}%</strong>
      </p>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a1f18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;">🐑</span>
      <h1 style="color:#ffffff;margin:8px 0 4px;font-size:22px;font-weight:700;">Weekly Audit</h1>
      <p style="color:#6b7280;margin:0;font-size:14px;">${company} · ${dateRange}</p>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:10px;padding:16px;text-align:center;">
        <p style="color:#f87171;font-size:24px;font-weight:700;margin:0;">${ups.length}</p>
        <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">Price Increases</p>
      </div>
      <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:10px;padding:16px;text-align:center;">
        <p style="color:#4ade80;font-size:24px;font-weight:700;margin:0;">${downs.length}</p>
        <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">Price Drops</p>
      </div>
      <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:10px;padding:16px;text-align:center;">
        <p style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">${invoices.length}</p>
        <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">Invoices Processed</p>
      </div>
    </div>

    ${alerts.length > 0 ? `
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid #1a4a3a;">
        <h3 style="color:#ffffff;margin:0;font-size:15px;">Top Price Movements This Week</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0a1f18;">
          <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Product</th>
          <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Vendor</th>
          <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Change</th>
        </tr></thead>
        <tbody>${topAlerts}</tbody>
      </table>
    </div>` : `
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="color:#4ade80;font-size:32px;margin:0;">✅</p>
      <p style="color:#ffffff;font-weight:600;margin:8px 0 4px;">Stable week</p>
      <p style="color:#9ca3af;font-size:13px;margin:0;">No significant price changes detected this week</p>
    </div>`}

    ${alternatives.length > 0 ? `
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <h3 style="color:#ffffff;margin:0 0 14px;font-size:15px;">💡 Savings Opportunities</h3>
      ${altRows}
    </div>` : ''}

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.shepherdsignals.com'}/dashboard"
         style="background:#1a4a3a;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        Open Full Dashboard →
      </a>
    </div>

    <p style="text-align:center;color:#374151;font-size:12px;">
      ShepherdSignals Weekly Audit · <a href="mailto:shepherdsargent@shepherdsignals.com" style="color:#374151;">Contact Shepherd</a>
    </p>
  </div>
</body>
</html>`
}
