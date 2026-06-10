import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { processInvoice } from '@/lib/process-invoice'

// Correct project: zsqrtnrfjxdjwqvssbtb (ShepherdSignals)
const SUPABASE_URL = 'https://zsqrtnrfjxdjwqvssbtb.supabase.co'

export const runtime = 'nodejs'
export const maxDuration = 60

function serviceClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Retry processing for a flagged invoice (only if it belongs to the caller's company)
export async function PUT(request: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Invoice id required' }, { status: 400 })

    const admin = serviceClient()
    const { data: cu } = await admin.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) return NextResponse.json({ error: 'No company linked to this account' }, { status: 403 })

    const { data: invoice } = await admin.from('invoices').select('id, company_id').eq('id', id).single()
    if (!invoice || invoice.company_id !== cu.company_id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const result = await processInvoice(id)
    if (result.error) return NextResponse.json(result, { status: 500 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}

// Delete an invoice (only if it belongs to the caller's company)
export async function DELETE(request: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Invoice id required' }, { status: 400 })

    const admin = serviceClient()

    const { data: cu } = await admin
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    if (!cu) return NextResponse.json({ error: 'No company linked to this account' }, { status: 403 })

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, company_id')
      .eq('id', id)
      .single()
    if (!invoice || invoice.company_id !== cu.company_id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { error: delErr } = await admin.from('invoices').delete().eq('id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ deleted: id })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the caller from their session cookie
    const authClient = createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = serviceClient()

    // 2. Resolve the caller's company
    const { data: cu } = await admin
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!cu) {
      return NextResponse.json(
        { error: 'This account is not linked to a company yet — contact shepherdsargent@shepherdsignals.com to get set up.' },
        { status: 400 }
      )
    }

    // 3. Read the uploaded file
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // 4. Upload to storage (service role — not blocked by storage RLS)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${cu.company_id}/${Date.now()}-${safeName}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('invoices')
      .upload(path, bytes, { contentType: file.type || 'application/octet-stream' })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('invoices').getPublicUrl(path)

    // 5. Insert the invoice record
    const { data: invoice, error: dbError } = await admin
      .from('invoices')
      .insert({
        company_id: cu.company_id,
        file_url: urlData.publicUrl,
        status: 'pending',
      })
      .select('id')
      .single()

    if (dbError || !invoice) {
      return NextResponse.json({ error: dbError?.message ?? 'Failed to save invoice record' }, { status: 500 })
    }

    // 6. Process immediately: Gemini extraction → price alerts → email
    const processing = await processInvoice(invoice.id)

    return NextResponse.json({
      id: invoice.id,
      file_url: urlData.publicUrl,
      processed: !!processing.success,
      alerts: processing.alerts ?? 0,
      items: processing.items ?? 0,
      processing_error: processing.error ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
