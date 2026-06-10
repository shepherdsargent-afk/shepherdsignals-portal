import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Correct project: zsqrtnrfjxdjwqvssbtb (ShepherdSignals)
const SUPABASE_URL = 'https://zsqrtnrfjxdjwqvssbtb.supabase.co'

// Flag increases above this percentage (catches gradual price creep)
const ALERT_THRESHOLD_PCT = 2.5

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest']

function svc() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface ExtractedItem {
  item: string
  unit: string
  price: number
  quantity: number
  total: number
}

interface ExtractedInvoice {
  vendor_name: string
  invoice_number: string
  invoice_date: string
  total: number
  items: ExtractedItem[]
}

export async function processInvoice(invoiceId: string): Promise<{ success?: boolean; items?: number; alerts?: number; error?: string; skipped?: string }> {
  const supabase = svc()

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('*, companies(id, name, contact_email, plan, state)')
    .eq('id', invoiceId)
    .single()

  if (invErr || !invoice) return { error: 'Invoice not found' }
  if (invoice.status === 'processed') return { skipped: 'already processed' }

  // Atomic claim — the DB webhook and the upload route can both trigger processing;
  // only the first one to stamp processed_at proceeds. Flagged (errored) invoices
  // can always be reclaimed so they are retryable.
  // Stale claims (function killed mid-processing) become reclaimable after 2 minutes.
  const staleCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: claimed } = await supabase
    .from('invoices')
    .update({ processed_at: new Date().toISOString(), status: 'pending', notes: null })
    .eq('id', invoiceId)
    .or(`processed_at.is.null,status.eq.flagged,and(status.eq.pending,processed_at.lt.${staleCutoff})`)
    .select('id')
  if (!claimed || claimed.length === 0) return { skipped: 'already being processed' }

  try {
    const pdfText = await extractPdfText(invoice.file_url)
    const extracted = await extractInvoiceData(pdfText)

    const vendorId = await resolveVendor(supabase, extracted.vendor_name, invoice.company_id)

    await supabase
      .from('invoices')
      .update({
        vendor_id: vendorId,
        invoice_number: extracted.invoice_number || null,
        invoice_date: extracted.invoice_date || null,
        total_amount: extracted.total || null,
      })
      .eq('id', invoiceId)

    const alerts: any[] = []
    for (const item of extracted.items) {
      try {
        const alert = await processLineItem(supabase, item, invoice.company_id, vendorId, extracted)
        if (alert) alerts.push(alert)
      } catch (err: any) {
        console.error(`[process-invoice] item "${item.item}":`, err.message)
      }
    }

    if (alerts.length > 0 && invoice.companies?.contact_email) {
      try {
        await sendAlertEmail(supabase, invoice.companies, extracted.vendor_name, alerts)
      } catch (err: any) {
        console.error('[process-invoice] email failed:', err.message)
      }
    }

    await supabase
      .from('invoices')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', invoiceId)

    return { success: true, items: extracted.items.length, alerts: alerts.length }
  } catch (err: any) {
    await supabase.from('invoices').update({ status: 'flagged', notes: 'Processing error: ' + String(err?.message ?? err).slice(0, 200) }).eq('id', invoiceId)
    console.error('[process-invoice] fatal:', err.message)
    return { error: String(err?.message ?? err) }
  }
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(fileUrl: string): Promise<string> {
  if (!fileUrl) throw new Error('Invoice has no file attached')
  const res = await fetch(fileUrl)
  if (!res.ok) throw new Error(`PDF download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const pdfParse = (await import('pdf-parse')).default
  const parsed = await pdfParse(buf)
  return parsed.text
}

// ─── Gemini extraction (vendor + metadata + line items in one call) ───────────

const RETRYABLE = /not found|404|NOT_FOUND|unsupported|503|unavailable|overloaded|429|RESOURCE_EXHAUSTED|quota|fetch failed|ECONNRESET|timeout/i

async function generateWithFallback(prompt: string): Promise<string> {
  const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  let lastErr: any = null
  // Retry across the model chain, but stay inside the serverless time budget —
  // running out of retries beats the function being killed mid-flight.
  const deadline = Date.now() + 35_000
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const modelName of GEMINI_MODELS) {
      if (Date.now() > deadline) throw lastErr ?? new Error('Gemini retry budget exceeded')
      try {
        const model = gemini.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        return result.response.text().trim()
      } catch (err: any) {
        lastErr = err
        if (!RETRYABLE.test(String(err?.message))) throw err
      }
    }
    if (attempt < 2 && Date.now() + 3000 < deadline) await new Promise(r => setTimeout(r, 3000))
  }
  throw lastErr ?? new Error('All Gemini models failed')
}

async function extractInvoiceData(pdfText: string): Promise<ExtractedInvoice> {
  const prompt = `You are a procurement data extraction assistant for golf club F&B and facilities operations.

Extract the following from this invoice and return ONE JSON object (no markdown fences, no explanation):
{
  "vendor_name": "supplier/vendor company name as printed on the invoice",
  "invoice_number": "invoice number/ID as printed",
  "invoice_date": "invoice date in YYYY-MM-DD format",
  "total": <grand total as decimal number>,
  "items": [
    { "item": "product name", "unit": "unit of measure (case, bag, jug, each, kg, L...)", "price": <unit price decimal>, "quantity": <quantity decimal>, "total": <line total decimal> }
  ]
}

Rules:
- Return ONLY valid JSON
- Skip header rows, subtotals, taxes, delivery/freight charges, and non-product lines
- If a field is missing use "" for strings and 0 for numbers
- "items" must include every product line item

Invoice text:
${pdfText}`

  const raw = await generateWithFallback(prompt)
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    vendor_name: parsed.vendor_name ?? '',
    invoice_number: parsed.invoice_number ?? '',
    invoice_date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.invoice_date ?? '') ? parsed.invoice_date : new Date().toISOString().slice(0, 10),
    total: Number(parsed.total) || 0,
    items: Array.isArray(parsed.items) ? parsed.items.filter((i: any) => i.item && Number(i.price) > 0) : [],
  }
}

// ─── Vendor resolution (match existing or create) ─────────────────────────────

async function resolveVendor(supabase: any, vendorName: string, companyId: string): Promise<string | null> {
  const name = (vendorName || '').trim()
  if (!name) return null

  const { data: vendors } = await supabase.from('vendors').select('id, name')
  const lower = name.toLowerCase()
  let vendor = (vendors ?? []).find((v: any) => {
    const vn = v.name.toLowerCase()
    return vn === lower || vn.includes(lower) || lower.includes(vn) ||
      // match on first two significant words ("Greenway Turf" ⊂ "Greenway Turf & Grounds Supply Co.")
      lower.split(/\s+/).slice(0, 2).join(' ') === vn.split(/\s+/).slice(0, 2).join(' ')
  })

  if (!vendor) {
    const { data: created } = await supabase
      .from('vendors')
      .insert({ name, is_verified: false, notes: 'Auto-created from invoice processing' })
      .select('id, name')
      .single()
    vendor = created
  }
  if (!vendor) return null

  // Ensure company ↔ vendor link exists
  const { data: link } = await supabase
    .from('company_vendors')
    .select('id')
    .eq('company_id', companyId)
    .eq('vendor_id', vendor.id)
    .maybeSingle()
  if (!link) {
    await supabase.from('company_vendors').insert({ company_id: companyId, vendor_id: vendor.id })
  }

  return vendor.id
}

// ─── Per line item: benchmark, alert, record ──────────────────────────────────

async function processLineItem(
  supabase: any,
  item: ExtractedItem,
  companyId: string,
  vendorId: string | null,
  inv: ExtractedInvoice
): Promise<any | null> {
  // Find or create product — fuzzy match so name variations never create duplicates
  const { data: allProducts } = await supabase.from('products').select('id, name, unit')
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(item.item)
  let product = (allProducts ?? []).find((p: any) => {
    const pn = norm(p.name)
    return pn === target || pn.includes(target) || target.includes(pn)
  }) ?? null
  if (!product) {
    const { data: created } = await supabase
      .from('products')
      .insert({ name: item.item.trim(), unit: item.unit || 'each', description: 'Auto-created from invoice processing' })
      .select('id, name, unit')
      .single()
    product = created
  }
  if (!product) return null

  // Most recent benchmark for this company + product (+ vendor when known)
  let q = supabase
    .from('price_records')
    .select('id, price, invoice_date, created_at')
    .eq('company_id', companyId)
    .eq('product_id', product.id)
  if (vendorId) q = q.eq('vendor_id', vendorId)
  const { data: lastRecords } = await q.order('invoice_date', { ascending: false }).order('created_at', { ascending: false }).limit(1)
  const lastRecord = lastRecords?.[0] ?? null

  let alertCreated: any = null

  if (lastRecord && Number(lastRecord.price) > 0) {
    const oldPrice = Number(lastRecord.price)
    const changePct = ((item.price - oldPrice) / oldPrice) * 100

    if (changePct > ALERT_THRESHOLD_PCT) {
      const annualImpact = Math.round((item.price - oldPrice) * (item.quantity || 1) * 12 * 100) / 100
      const message =
        `${product.name} (${item.unit || product.unit || 'unit'}) increased ${changePct.toFixed(1)}% — ` +
        `from $${oldPrice.toFixed(2)} to $${item.price.toFixed(2)}. ` +
        `At this order volume (${item.quantity || 1}/order, est. monthly), this adds ~$${Math.abs(annualImpact).toLocaleString('en-CA', { maximumFractionDigits: 0 })}/year. ` +
        `Flagged from invoice ${inv.invoice_number || '—'}.`

      const { data: alert } = await supabase
        .from('price_alerts')
        .insert({
          company_id: companyId,
          vendor_id: vendorId,
          product_id: product.id,
          old_price: oldPrice,
          new_price: item.price,
          change_pct: Math.round(Math.abs(changePct) * 10) / 10,
          change_direction: 'up',
          alert_type: 'price_change',
          message,
          is_read: false,
        })
        .select()
        .single()
      if (alert) alertCreated = { ...alert, product_name: product.name, annual_impact: annualImpact }
    }
  }

  // Record this price as the new baseline (always)
  await supabase.from('price_records').insert({
    company_id: companyId,
    vendor_id: vendorId,
    product_id: product.id,
    price: item.price,
    unit: item.unit || product.unit || null,
    invoice_date: inv.invoice_date,
    invoice_number: inv.invoice_number || null,
    notes: 'Auto from invoice processing',
  })

  return alertCreated
}

// ─── Immediate alert email (Resend) ───────────────────────────────────────────

async function sendAlertEmail(supabase: any, company: any, vendorName: string, alerts: any[]) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject = `🚨 ${alerts.length} price alert${alerts.length > 1 ? 's' : ''} detected — ${company.name}`
  const html = buildAlertEmailHtml(company.name, vendorName || 'your vendor', alerts)

  const { data: sent } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'ShepherdSignals <signals@shepherdsignals.com>',
    to: company.contact_email,
    subject,
    html,
  })

  await supabase.from('email_log').insert({
    company_id: company.id,
    email_type: 'alert',
    recipient_email: company.contact_email,
    subject,
    resend_id: sent?.id ?? null,
    status: 'sent',
  })

  const ids = alerts.map(a => a.id).filter(Boolean)
  if (ids.length) {
    await supabase.from('price_alerts').update({ emailed_at: new Date().toISOString() }).in('id', ids)
  }
}

function buildAlertEmailHtml(companyName: string, vendorName: string, alerts: any[]): string {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const rows = alerts
    .map(
      (a) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;">${a.product_name ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;font-weight:600;color:#f87171;">+${Number(a.change_pct ?? 0).toFixed(1)}%</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#9ca3af;">$${Number(a.old_price ?? 0).toFixed(2)} → <strong style="color:#f87171;">$${Number(a.new_price ?? 0).toFixed(2)}</strong></td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a4a3a;color:#9ca3af;">$${Math.abs(a.annual_impact ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr</td>
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
        <strong style="color:#f87171;">${alerts.length} price increase${alerts.length > 1 ? 's' : ''}</strong>.
        Review below and take action where recommended.
      </p>
    </div>
    <div style="background:#0d2b22;border:1px solid #1a4a3a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0a1f18;">
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Product</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Change</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Price</th>
            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:500;">Annual Impact</th>
          </tr>
        </thead>
        <tbody style="color:#e5e7eb;">${rows}</tbody>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.shepherdsignals.com'}/dashboard/alerts"
         style="background:#1a4a3a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
        View Full Dashboard →
      </a>
    </div>
    <p style="text-align:center;color:#374151;font-size:12px;">
      ShepherdSignals · You're receiving this because we detected price changes on your account.
    </p>
  </div>
</body>
</html>`
}
