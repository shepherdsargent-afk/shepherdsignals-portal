'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

export default function InvoicesPage() {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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
    setLoaded(true)
  }

  if (!loaded) {
    loadInvoices()
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setUploading(false); return }

    const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) { setError('No company found'); setUploading(false); return }

    // Upload to Supabase Storage
    const fileName = `${cu.company_id}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, file, { contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName)

    // Create invoice record
    const { error: dbError } = await supabase.from('invoices').insert({
      company_id: cu.company_id,
      file_url: urlData.publicUrl,
      status: 'pending',
    })

    if (dbError) {
      setError(dbError.message)
    } else {
      setSuccess(true)
      if (fileRef.current) fileRef.current.value = ''
      setLoaded(false) // reload list
    }
    setUploading(false)
  }

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-400/10',
    processed: 'text-green-400 bg-green-400/10',
    flagged: 'text-red-400 bg-red-400/10',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <p className="text-gray-400 mt-1">Upload invoices so Shepherd can extract pricing data</p>
      </div>

      {/* Upload */}
      <div className="card mb-6">
        <h2 className="text-white font-semibold mb-4">Upload Invoice</h2>
        <form onSubmit={handleUpload} className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className="block text-sm text-gray-400 mb-2">Select PDF or image</label>
            <input
              ref={fileRef}
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
        {success && <p className="text-green-400 text-sm mt-3">✅ Invoice uploaded — Shepherd will process it shortly</p>}
        {error && <p className="text-red-400 text-sm mt-3">❌ {error}</p>}
      </div>

      {/* Invoice List */}
      <div className="card">
        <h2 className="text-white font-semibold mb-4">Invoice History</h2>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/3 transition-colors">
                <span className="text-2xl">🧾</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    {inv.invoice_number ? `Invoice #${inv.invoice_number}` : 'Invoice'}
                    {inv.vendors?.name && <span className="text-gray-500 font-normal"> — {inv.vendors.name}</span>}
                  </p>
                  <p className="text-gray-600 text-xs">{format(new Date(inv.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                {inv.total_amount && (
                  <p className="text-white font-medium">${inv.total_amount.toFixed(2)}</p>
                )}
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColor[inv.status] ?? ''}`}>
                  {inv.status}
                </span>
                {inv.file_url && (
                  <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white text-xs">
                    View ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-3">🧾</div>
            <p>No invoices uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
