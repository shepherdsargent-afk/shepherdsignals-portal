import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Correct project: zsqrtnrfjxdjwqvssbtb (ShepherdSignals)
const SUPABASE_URL = 'https://zsqrtnrfjxdjwqvssbtb.supabase.co'

export const runtime = 'nodejs'

// Demo invoice numbers whose price records must never persist as baselines
// (the demo PDFs contain these exact prices — they'd zero out the live demo)
const DEMO_INVOICE_NUMBERS = ['SS-2026-0041', 'GS-2026-0187', 'MP-2026-0093']

/**
 * Resets the caller's company to a clean pre-demo state:
 *  - deletes ALL invoices
 *  - deletes ALL price alerts
 *  - deletes price records created by invoice processing + the demo-invoice records
 *  - optionally updates contact_email / plan (body: { contact_email?, plan? })
 * Run before every live demo so uploads regenerate alerts fresh.
 */
export async function POST(request: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: cu } = await admin
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    if (!cu) return NextResponse.json({ error: 'No company linked to this account' }, { status: 403 })

    const companyId = cu.company_id
    let body: any = {}
    try { body = await request.json() } catch {}

    const { count: invDel } = await admin.from('invoices').delete({ count: 'exact' }).eq('company_id', companyId)
    const { count: alertDel } = await admin.from('price_alerts').delete({ count: 'exact' }).eq('company_id', companyId)
    const { count: recDel1 } = await admin.from('price_records').delete({ count: 'exact' })
      .eq('company_id', companyId).in('invoice_number', DEMO_INVOICE_NUMBERS)
    const { count: recDel2 } = await admin.from('price_records').delete({ count: 'exact' })
      .eq('company_id', companyId).eq('notes', 'Auto from invoice processing')

    const updates: any = {}
    if (typeof body.contact_email === 'string' && body.contact_email.includes('@')) updates.contact_email = body.contact_email
    if (['daily', 'weekly', 'both'].includes(body.plan)) updates.plan = body.plan
    if (Object.keys(updates).length) {
      await admin.from('companies').update(updates).eq('id', companyId)
    }

    return NextResponse.json({
      reset: true,
      invoices_deleted: invDel ?? 0,
      alerts_deleted: alertDel ?? 0,
      price_records_deleted: (recDel1 ?? 0) + (recDel2 ?? 0),
      company_updates: updates,
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
