'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

export default function InvoicesPage() {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Load invoices properly with useEffect — never call async in render body
  useEffect(() => {
    let cancelled = false

    async function loadInvoices() {
      setLoading(true)
      setLoadError('')
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const { data: cu, error: cuErr } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (cuErr || !cu || cancelled) {
          if (cuErr) setLoadError('Could not load company — ' + cuErr.message)
          return
        }

        const { data, error: fetchErr } = await supabase
          .from('invoices')
          .select('*, vendors(name)')
          .eq('company_id', cu.company_id)
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (fetchErr) {
          setLoadError('Could not load invoices — ' + fetchErr.message)
        } else {
          setInvoices(data ?? [])
        }
      } catch (e: any) {
        if (!cancelled) setLoadError('Unexpected error: ' + e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInvoices()
    return () => { cancelled = true }
  }, [refreshKey])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess(false)

    // Upload via server route (handles storage + invoice record with proper permissions)
    const formData = new FormData()
    formData.append('file', file)

    let insertedInvoice: { id: string } | null = null
    try {
      const res = await fetch('/api/upload-invoice', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        setUploading(false)
        return
      }
      insertedInvoice = json
    } catch (err: any) {
      setError('Upload failed — ' + String(err?.message ?? err))
      setUploading(false)
      return
    }

    if (!insertedInvoice?.id) {
      setError('Failed to save invoice record')
      setUploading(false)
      return
    }

    const r: any = insertedInvoice
    if (r.processed) {
      setResultMsg(
        r.alerts > 0
          ? `Invoice processed — ${r.alerts} price alert${r.alerts > 1 ? 's' : ''} detected. Check Price Alerts.`
          : 'Invoice processed — no price increases detected.'
      )
    } else {
      setResultMsg('Invoice uploaded — Shepherd is reviewing it now.')
    }
    setSuccess(true)
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)

    // Refresh the list
    setRefreshKey(k => k + 1)
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
        <p className="text-gray-400 mt-1">Upload invoices so Shepherd can extract pricing data</p>
      </div>

      {/* Upload card */}
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
            {uploading ? 'Analyzing invoice...' : 'Upload'}
          </button>
        </form>
        {uploading && (
          <p className="text-gray-400 text-sm mt-3">
            Extracting line items and checking prices against your history — this takes about 30 seconds
          </p>
        )}
        {success && (
          <p className="text-green-400 text-sm mt-3">{resultMsg}</p>
        )}
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {/* Invoice list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Invoice History</h2>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">
            <p className="text-sm">Loading invoices...</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-10">
            <p className="text-red-400 text-sm">{loadError}</p>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="mt-3 text-xs text-gray-500 hover:text-white transition-colors underline"
            >
              Try again
            </button>
          </div>
        ) : invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/3 transition-colors">
                <span className="text-2xl">🧾</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    {inv.invoice_number ? `Invoice #${inv.invoice_number}` : 'Invoice'}
                    {inv.vendors?.name && (
                      <span className="text-gray-500 font-normal"> — {inv.vendors.name}</span>
                    )}
                  </p>
                  <p className="text-gray-600 text-xs">
                    {format(new Date(inv.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                {inv.total_amount && (
                  <p className="text-white font-medium">${inv.total_amount.toFixed(2)}</p>
                )}
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColor[inv.status] ?? ''}`}>
                  {inv.status}
                </span>
                {inv.file_url && (
                  <a
                    href={inv.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-white text-xs"
                  >
                    View
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