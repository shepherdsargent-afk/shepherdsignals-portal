'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

const EDGE_BASE = 'https://lmrgzsfvzzdoatpddjvb.supabase.co/functions/v1'

export default function InvoicesPage() {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const supabase = createClient()

  async function loadInvoices() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) return
    const { data } = await supabase
      .from('invoices')
      .select('*, vendors(name)')
      .eq('company_id', cu.company_id)
      .order('created_at', { ascending: false })
    setInvoices(data ?? [])
  }

  useEffect(() => { loadInvoices() }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const input = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement
    const file = input?.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setUploading(false); return }

    const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) { setError('No company found'); setUploading(false); return }

    const fileName = `${cu.company_id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('invoices').upload(fileName, file, { contentType: file.type })
    if (uploadError) { setError(uploadError.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName)

    const { data: inserted, error: dbError } = await supabase
      .from('invoices')
      .insert({ company_id: cu.company_id, file_url: urlData.publicUrl, status: 'pending' })
      .select('id').single()

    if (dbError || !inserted) { setError(dbError?.message ?? 'Failed to save'); setUploading(false); return }

    if (input) input.value = ''
    setSuccess(true)
    setUploading(false)
    loadInvoices()

    const sessionRes = await supabase.auth.getSession()
    const token = sessionRes.data.session?.access_token
    if (token) {
      fetch(`${EDGE_BASE}/process-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceId: inserted.id }),
      }).then(() => setTimeout(() => loadInvoices(), 8000)).catch(() => {})
    }
  }

  async function handleDelete(inv: any) {
    if (!confirm('Remove this invoice?')) return
    if (inv.file_url) {
      const match = inv.file_url.match(/\/object\/(?:public|sign)\/invoices\/(.+)/)
      if (match) await supabase.storage.from('invoices').remove([decodeURIComponent(match[1])])
    }
    await supabase.from('invoices').delete().eq('id', inv.id)
    setInvoices(prev => prev.filter(i => i.id !== inv.id))
  }

  const statusColor: Record<string, string> = {
    pending:   'text-yellow-400 bg-yellow-400/10',
    processed: 'text-green-400 bg-green-400/10',
    flagged:   'text-red-400 bg-red-400/10',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <p className="text-gray-400 mt-1">Upload invoices so ShepherdSignals can extract pricing data</p>
      </div>

      <div className="card mb-6">
        <h2 className="text-white font-semibold mb-4">Upload Invoice</h2>
        <form onSubmit={handleUpload} className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className="block text-sm text-gray-400 mb-2">Select PDF or image</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-mid file:text-white file:cursor-pointer hover:file:bg-brand-mid/80"
            />
          </div>
          <button type="submit" disabled={uploading} className="btn-primary px-6 py-2.5 shrink-0 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
        {success && <p className="text-green-400 text-sm mt-3">Invoice uploaded - ShepherdSignals is processing it now</p>}
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <div className="card">
        <h2 className="text-white font-semibold mb-4">Invoice History</h2>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-brand-mid/40 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {inv.invoice_number ? `Invoice #${inv.invoice_number}` : 'Invoice'}
                    {inv.vendors?.name && <span className="text-gray-500 font-normal"> - {inv.vendors.name}</span>}
                  </p>
                  <p className="text-gray-600 text-xs">{format(new Date(inv.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                {inv.total_amount && <p className="text-white font-medium">${Number(inv.total_amount).toFixed(2)}</p>}
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColor[inv.status] ?? ''}`}>
                  {inv.status}
                </span>
                {inv.file_url && (
                  <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white text-xs shrink-0">View</a>
                )}
                <button
                  onClick={() => handleDelete(inv)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 shrink-0 p-1 rounded"
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <p>No invoices uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}