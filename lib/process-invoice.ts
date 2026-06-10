import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Correct project: zsqrtnrfjxdjwqvssbtb (ShepherdSignals)
const SUPABASE_URL = 'https://zsqrtnrfjxdjwqvssbtb.supabase.co'

// Flag increases above this percentage (catches gradual price creep)
const ALERT_THRESHOLD_PCT = 2.5

// Static fallback only — the real chain is discovered live from Google's ListModels
// API (gemini-1.5-* returned 404 in June 2026; hardcoded lists rot as Google rotates models)
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite']

let cachedModels: string[] | null = null

async function getModelChain(): Promise<string[]> {
  if (cachedModels) return cachedModels
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=200`
    )
    if (res.ok) {
      const json = await res.json()
      const names: string[] = (json.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => String(m.name).replace('models/', ''))
        .filter((n: string) => /flash/i.test(n) && !/preview|exp|image|tts|live|thinking|8b/i.test(n))
      // newest version first; full flash before lite at the same version
      const score = (n: string) => {
        const ver = parseFloat(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? '0')
        return ver * 10 - (/lite/.test(n) ? 1 : 0)
      }
      names.sort((a, b) => score(b) - score(a))
      if (names.length) cachedModels = Array.from(new Set([...names, ...GEMINI_MODELS]))
    }
  } catch {}
  if (!cachedModels) cachedModels = GEMINI_MODELS
  return cachedModels
}

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
    let extracted: ExtractedInvoice
    try {
      extracted = await extractInvoiceData(pdfText)
    } catch (geminiErr: any) {
      // Gemini unavailable — fall back to the deterministic text parser.
      // Only fail the invoice if BOTH extraction paths produce nothing.
      console.error('[process-invoice] Gemini failed, using fallback parser:', geminiErr?.message)
      extracted = parseInvoiceTextFallback(pdfText)
      if (!extracted.items.length) throw geminiErr
    }

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
  const models = await getModelChain()
  let lastErr: any = null
  // Retry across the model chain, but stay inside the serverless time budget —
  // running out of retries beats the function being killed mid-flight.
  const deadline = Date.now() + 35_000
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const modelName of models) {
      if (Date.now() > deadline) throw lastErr ?? new Error('Gemini retry budget exceeded')
      try {
        const model = gemini.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        return result.response.text().trim()
      } catch (err: any) {
        lastErr = err
        if (!RETRYABLE.test(String(err?.message))) throw err
        // A model that 404s is gone — drop it from the cached chain
        if (/not found|404|NOT_FOUND/i.test(String(err?.message)) && cachedModels) {
          cachedModels = cachedModels.filter(m => m !== modelName)
        }
      }
    }
    if (attempt < 3 && Date.now() + 2000 < deadline) await new Promise(r => setTimeout(r, 2000))
  }
  throw lastErr ?? new Error('All Gemini models failed')
}

// ─── Deterministic fallback parser ────────────────────────────────────────────
// If Gemini is unavailable (outage / rate limit), parse the invoice text directly.
// Handles standard tabular invoices: SKU + description — unit + qty + $unit + $total.
// Ambiguous digit runs (e.g. "32-0-8" + qty "20" → "32-0-820") are resolved by
// validating qty × unit price ≈ line total.

export function parseInvoiceTextFallback(pdfText: string): ExtractedInvoice {
  const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean)

  // Vendor: leading lines before the first line containing a digit (the address)
  const vendorParts: string[] = []
  for (const line of lines) {
    if (/\d/.test(line) || /^INVOICE$/i.test(line)) break
    vendorParts.push(line)
    if (vendorParts.length >= 3) break
  }
  const vendor_name = vendorParts.join(' ').trim()

  const invNumMatch = pdfText.match(/Invoice\s*#?:?\s*\n?\s*([A-Z]{2,4}-\d{2,4}-\d{2,6})/i)
  const dateMatch = pdfText.match(/Date:?\s*\n?\s*([A-Za-z]+ \d{1,2}, \d{4})/)
  const totalMatch = pdfText.match(/TOTAL\s+DUE:?\s*\$?\s*([\d,]+\.\d{2})/i) ?? pdfText.match(/Subtotal:?\s*\$?\s*([\d,]+\.\d{2})/i)

  let invoice_date = new Date().toISOString().slice(0, 10)
  if (dateMatch) {
    const d = new Date(dateMatch[1])
    if (!isNaN(d.getTime())) invoice_date = d.toISOString().slice(0, 10)
  }

  const items: ExtractedItem[] = []
  const lineRe = /^([A-Z]{2,4}-\d{3,5})(.+)$/
  for (const line of lines) {
    const m = line.match(lineRe)
    if (!m) continue
    const rest = m[2]
    // split on the dollar amounts: <desc+qty>$<unit>$<total>
    const money = rest.match(/^(.*?)\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})\s*$/)
    if (!money) continue
    const head = money[1]
    const price = parseFloat(money[2].replace(/,/g, ''))
    const lineTotal = parseFloat(money[3].replace(/,/g, ''))
    const tail = head.match(/(\d+)\s*$/)
    if (!tail || !price) continue
    // resolve qty: try suffixes of the trailing digit run, validate against total
    const digits = tail[1]
    let qty = 0
    for (let len = 1; len <= digits.length; len++) {
      const candidate = parseInt(digits.slice(digits.length - len), 10)
      if (candidate > 0 && Math.abs(candidate * price - lineTotal) < 0.06) { qty = candidate; break }
    }
    if (!qty) qty = parseInt(digits, 10)
    const desc = head.slice(0, head.length - (qty.toString().length)).replace(/\s+$/, '')
    const [namePart, unitPart] = desc.split(/\s+—\s+/)
    items.push({
      item: (namePart ?? desc).trim(),
      unit: (unitPart ?? '').trim() || 'each',
      price,
      quantity: qty,
      total: lineTotal,
    })
  }

  return {
    vendor_name,
    invoice_number: invNumMatch?.[1] ?? '',
    invoice_date,
    total: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0,
    items,
  }
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
      <div style="display:inline-flex;align-items:center;margin-bottom:8px;">
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
