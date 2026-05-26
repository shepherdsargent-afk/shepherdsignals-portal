import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { GoogleGenerativeAI } from '@google/generative-ai'

const resend = new Resend(process.env.RESEND_API_KEY)
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Service-role client — bypasses RLS, required for webhook context
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface LineItem {
  item: string
  vendor: string
  unit: string
  price: number
  quantity: number
  total: number
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const webhookHeader = request.headers.get('x-webhook-secret')
  const isAuthorized =
    auth === `Bearer ${process.env.WEBHOOK_SECRET}` ||
    webhookHeader === process.env.WEBHOOK_SECRET

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Support Supabase DB webhook { type, table, record } and direct { invoice_id }
  const record = body.record ?? body
  const invoiceId: string = record.id ?? body.invoice_id

  if (!invoiceId) {
    return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('*, companies(id, name, contact_email, province), vendors(id, name)')
    .eq('id', invoiceId)
    .single()

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Prevent double-processing
  if (invoice.status === 'processed' || invoice.status === 'processing') {
    return NextResponse.json({ message: `Invoice already ${invoice.status}` })
  }

  await supabase.from('invoices').update({ status: 'processing' }).eq('id', invoiceId)

  try {
    const pdfText = await extractPdfText(supabase, invoice.file_url)
    const lineItems = await extractLineItems(pdfText)

    if (!lineItems.length) {
      await supabase
        .from('invoices')
        .update({ status: 'processed', processed_at: new Date().toISOString(), alerts_found: 0 })
        .eq('id', invoiceId)
      return NextResponse.json({ success: true, invoice_id: invoiceId, items_processed: 0, alerts_created: 0 })
    }

    // Process each item in isolation — one failure never stops the rest
    const alertsCreated: any[] = []
    const errors: any[] = []

    for (const item of lineItems) {
      try {
        const alert = await processLineItem(supabase, item, invoice)
        if (alert) alertsCreated.push(alert)
      } catch (err: any) {
        errors.push({ item: item.item, error: err.message })
        console.error(`[process-invoice] Error on item "${item.item}":`, err.message)
      }
    }

    if (alertsCreated.length > 0 && invoice.companies?.contact_email) {
      await sendAlertEmail(supabase, invoice, alertsCreated)
    }

    await supabase
      .from('invoices')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        alerts_found: alertsCreated.length,
      })
      .eq('id', invoiceId)

    return NextResponse.json({
      success: true,
      invoice_id: invoiceId,
      items_processed: lineItems.length,
      alerts_created: alertsCreated.length,
      errors,
    })
  } catch (err: any) {
    await supabase.from('invoices').update({ status: 'error' }).eq('id', invoiceId)
    console.error('[process-invoice] Fatal error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── 1. PDF Text Extraction ───────────────────────────────────────────────────

async function extractPdfText(supabase: any, fileUrl: string): Promise<string> {
  let pdfBuffer: Buffer

  if (fileUrl.startsWith('http')) {
    const res = await fetch(fileUrl)
    if (!res.ok) throw new Error(`PDF download failed: ${res.status} ${res.statusText}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } else {
    const { data, error } = await supabase.storage.from('invoices').download(fileUrl)
    if (error) throw new Error(`Storage download failed: ${error.message}`)
    pdfBuffer = Buffer.from(await (data as Blob).arrayBuffer())
  }

  const pdfParse = (await import('pdf-parse')).default
  const parsed = await pdfParse(pdfBuffer)
  return parsed.text
}

// ─── 2. Line Item Extraction (Gemini Flash) ───────────────────────────────────

async function extractLineItems(pdfText: string): Promise<LineItem[]> {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

  const prompt = `You are a procurement data extraction assistant for golf club F&B and facilities operations.

Extract every line item from this invoice and return a JSON array. Each element must have exactly these fields:
- "item": product name (string)
- "vendor": supplier name if visible on the invoice, otherwise "" (string)
- "unit": unit of measure — kg, each, case, L, box, etc (string)
- "price": unit price as a decimal number (number)
- "quantity": quantity ordered as a decimal number (number)
- "total": line total as a decimal number (number)

Rules:
- Return ONLY a valid JSON array — no markdown fences, no explanation, no extra text
- If a field is missing, use 0 for numbers and "" for strings
- Skip header rows, subtotals, taxes, delivery charges, and non-product lines
- If no line items found, return []

Invoice text:
${pdfText}`

  const result = await model.generateContent(prompt)
  const raw = result.response.text().trim()
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed.filter((i: any) => i.item && i.price > 0) : []
  } catch {
    console.error('[process-invoice] Failed to parse Gemini line items:', cleaned.slice(0, 200))
    return []
  }
}

// ─── 3. Process a Single Line Item ───────────────────────────────────────────

async function processLineItem(supabase: any, item: LineItem, invoice: any): Promise<any | null> {
  const company = invoice.companies
  const vendor = invoice.vendors

  // Find or create product
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name, unit, category')
    .ilike('name', `%${item.item.trim()}%`)
    .limit(1)

  let product = existingProducts?.[0] ?? null

  if (!product) {
    const { data: newProduct } = await supabase
      .from('products')
      .insert({ name: item.item.trim(), unit: item.unit || 'each' })
      .select()
      .single()
    product = newProduct
  }

  if (!product) return null

  // Most recent benchmark: same company + vendor + product
  const { data: lastRecord } = await supabase
    .from('price_records')
    .select('id, price, recorded_at')
    .eq('company_id', company.id)
    .eq('vendor_id', vendor.id)
    .eq('product_id', product.id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let alertCreated: any = null

  if (lastRecord) {
    const changePct = ((item.price - lastRecord.price) / lastRecord.price) * 100

    if (changePct > 5) {
      const alertType = await detectAlertType(supabase, product.id, vendor.id, company.id)
      const avgMonthlyVolume = item.quantity * 4
      const annualImpact =
        Math.round((item.price - lastRecord.price) * avgMonthlyVolume * 12 * 100) / 100
      const recommendedAction = alertType === 'market_wide' ? 'switch_product' : 'switch_vendor'

      const { data: alert } = await supabase
        .from('price_alerts')
        .insert({
          company_id: company.id,
          vendor_id: vendor.id,
          product_id: product.id,
          invoice_id: invoice.id,
          old_price: lastRecord.price,
          new_price: item.price,
          change_pct: Math.abs(changePct),
          change_direction: 'up',
          alert_type: alertType,
          annual_impact: annualImpact,
          recommended_action: recommendedAction,
          status: 'new',
        })
        .select()
        .single()

      alertCreated = { ...alert, product_name: product.name, vendor_name: vendor.name }
    }

    // Update price_records with current price as new baseline
    await supabase.from('price_records').insert({
      company_id: company.id,
      vendor_id: vendor.id,
      product_id: product.id,
      price: item.price,
      recorded_at: new Date().toISOString(),
    })
  } else {
    // No prior record — fetch market rate, store as first baseline
    const marketRate = await fetchMarketRate(item.item, item.unit, company.province)

    await supabase.from('price_records').insert({
      company_id: company.id,
      vendor_id: vendor.id,
      product_id: product.id,
      price: marketRate ?? item.price,
      recorded_at: new Date().toISOString(),
    })
  }

  return alertCreated
}

// ─── 4. Market-Wide vs Vendor-Specific Detection ─────────────────────────────

async function detectAlertType(
  supabase: any,
  productId: string,
  vendorId: string,
  currentCompanyId: string
): Promise<'market_wide' | 'vendor_specific'> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: otherAlerts } = await supabase
    .from('price_alerts')
    .select('company_id')
    .eq('product_id', productId)
    .eq('vendor_id', vendorId)
    .eq('change_direction', 'up')
    .neq('company_id', currentCompanyId)
    .gte('created_at', thirtyDaysAgo)

  const { count: totalCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  if (!otherAlerts?.length || !totalCompanies || totalCompanies < 2) {
    return 'vendor_specific'
  }

  const affectedRatio = otherAlerts.length / (totalCompanies - 1)
  return affectedRatio > 0.5 ? 'market_wide' : 'vendor_specific'
}

// ─── 5. Market Rate Lookup (Gemini + Google Search Grounding) ─────────────────

async function fetchMarketRate(
  itemName: string,
  unit: string,
  province: string
): Promise<number | null> {
  try {
    const model = gemini.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      tools: [{ googleSearchRetrieval: {} } as any],
    })

    const prompt = `What is the current wholesale or foodservice price for "${itemName}" per ${unit || 'unit'} in ${province || 'Canada'} in Canadian dollars? Respond with ONLY a single decimal number. No currency symbol, no units, no explanation.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const price = parseFloat(text.replace(/[^0-9.]/g, ''))
    return isNaN(price) || price <= 0 ? null : price
  } catch (err: any) {
    console.error('[process-invoice] Market rate lookup failed:', err.message)
    return null
  }
}

// ─── 6. Send Alert Email via Resend ──────────────────────────────────────────

async function sendAlertEmail(supabase: any, invoice: any, alerts: any[]) {
  const company = invoice.companies
  const vendor = invoice.vendors

  const subject = `🚨 ${alerts.length} price alert${alerts.length > 1 ? 's' : ''} detected — ${company.name}`
  const html = buildInvoiceAlertEmail(company.name, vendor?.name ?? 'your vendor', alerts)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'signals@shepherdsignals.com',
    to: company.contact_email,
    subject,
    html,
  })

  await supabase.from('email_log').insert({
    company_id: company.id,
    email_type: 'invoice_alert',
    recipient_email: company.contact_email,
    subject,
    status: 'sent',
  })
}

function buildInvoiceAlertEmail(companyName: string, vendorName: string, alerts: any[]): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const alertRows = alerts
    .map(
      (a) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;">${a.product_name ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;font-weight:600;color:#f87171;">+${a.change_pct?.toFixed(1)}%</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#9ca3af;">
        $${a.old_price?.toFixed(2)} → <strong style="color:#f87171;">$${a.new_price?.toFixed(2)}</strong>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#9ca3af;">
        $${Math.abs(a.annual_impact ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;">
        <span style="background:${a.alert_type === 'market_wide' ? '#422006' : '#1e1b4b'};color:${a.alert_type === 'market_wide' ? '#fb923c' : '#818cf8'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">
          ${a.alert_type === 'market_wide' ? '🌐 Market-Wide' : '🏪 Vendor Issue'}
        </span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#4ade80;font-size:12px;font-weight:600;">
        ${a.recommended_action === 'switch_product' ? 'Switch Product' : 'Switch Vendor'}
      </td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a1f18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:24px;">🐑</span>
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">ShepherdSignals</span>
      </div>
      <p style="color:#6b7280;margin:0;font-size:14px;">Invoice Alert — ${date}</p>
    </div>
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;padding:24px;margin-bottom:20px;">
      <h2 style="color:#ffffff;margin:0 0 8px;font-size:18px;">${companyName}</h2>
      <p style="color:#9ca3af;margin:0;font-size:14px;line-height:1.6;">
        We processed a new invoice from <strong style="color:#ffffff;">${vendorName}</strong> and flagged
        <strong style="color:#f87171;">${alerts.length} price increase${alerts.length > 1 ? 's' : ''}</strong>
        above your 5% threshold. Review below and take action where recommended.
      </p>
    </div>
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid #1a4a3a;">
        <h3 style="color:#ffffff;margin:0;font-size:15px;">Flagged Items</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0a1f18;">
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Product</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Change</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Price</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Annual Impact</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Type</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Action</th>
          </tr>
        </thead>
        <tbody style="color:#e5e7eb;">${alertRows}</tbody>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.shepherdsignals.com'}/dashboard/alerts"
         style="background:#1a4a3a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        View Full Dashboard →
      </a>
    </div>
    <p style="text-align:center;color:#374151;font-size:12px;">
      ShepherdSignals · <a href="mailto:shepherdsargent@shepherdsignals.com" style="color:#374151;">shepherdsargent@shepherdsignals.com</a><br>
      You're receiving this because we detected price changes on your account.
    </p>
  </div>
</body>
</html>`
}
