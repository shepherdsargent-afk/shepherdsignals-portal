import { NextResponse } from 'next/server'
import { processInvoice } from '@/lib/process-invoice'

export const runtime = 'nodejs'
export const maxDuration = 60

// Called by the Supabase DB webhook (if installed) or internally.
export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const webhookHeader = request.headers.get('x-webhook-secret')
  const secret = process.env.WEBHOOK_SECRET
  const isAuthorized = !!secret && (auth === `Bearer ${secret}` || webhookHeader === secret)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const record = body.record ?? body
  const invoiceId: string = record.id ?? body.invoice_id ?? body.invoiceId

  if (!invoiceId) {
    return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 })
  }

  const result = await processInvoice(invoiceId)
  if (result.error) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
