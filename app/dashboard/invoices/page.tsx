'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

export default function InvoicesPage() {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [progress, setProgress] = useState('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
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
    const files = Array.from(fileRef.current?.files ?? [])
    if (!files.length) return

    setUploading(true)
    setError('')
    setSuccess(false)

    // Process files ONE AT A TIME — parallel calls trip Gemini rate limits
    const uploads: any[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(files.length > 1 ? `Processing invoice ${i + 1} of ${files.length} — ${file.name}` : `Analyzing ${file.name}`)
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/api/upload-invoice', { method: 'POST', body: formData })
        let json: any = null
        try { json = await res.json() } catch { json = { error: 'Processing took too long — use Retry on the invoice below' } }
        uploads.push(res.ok ? json : { error: json.error ?? 'Upload failed', name: file.name })
      } catch (err: any) {
        uploads.push({ error: String(err?.message ?? err), name: file.name })
      }
      // Refresh the list as each invoice lands
      setRefreshKey(k => k + 1)
    }
    setProgress('')

    const failed = uploads.filter((u: any) => u.error)
    const succeeded = uploads.filter((u: any) => !u.error)
    const totalAlerts = succeeded.reduce((sum: number, u: any) => sum + (u.alerts ?? 0), 0)

    if (failed.length) {
      setError(failed.map((f: any) => `${f.name}: ${f.error}`).join(' · '))
    }
    if (succeeded.length) {
      setResultMsg(
        totalAlerts > 0
          ? `${succeeded.length} invoice${succeeded.length > 1 ? 's' : ''} processed — ${totalAlerts} price alert${totalAlerts > 1 ? 's' : ''} detected. Check Price Alerts.`
          : `${succeeded.length} invoice${succeeded.length > 1 ? 's' : ''} processed — no price increases detected.`
      )
      setSuccess(true)
    }
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)

    // Refresh the list
    setRefreshKey(k => k + 1)
  }

  async function removeInvoice(id: string) {
    if (!window.confirm('Remove this invoice? Its price alerts and history entries will be deleted too.')) return
    setRemoving(id)
    try {
      await fetch('/api/upload-invoice', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {}
    setRemoving(null)
    setRefreshKey(k => k + 1)
  }

  async function retryInvoice(id: string) {
    setRetrying(id)
    try {
      const res = await fetch('/api/upload-invoice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setResultMsg(json.alerts > 0 ? `Invoice processed — ${json.alerts} price alert${json.alerts > 1 ? 's' : ''} detected.` : 'Invoice processed.')
        setSuccess(true)
      }
    } catch {}
    setRetrying(null)
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
            <label className="block text-sm text-gray-400 mb-2">Select PDF or image — multiple files supported</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
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
            {progress || 'Extracting line items and checking prices against your history'} …
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
                {(inv.status === 'flagged' || inv.status === 'pending') && (
                  <button
                    onClick={() => retryInvoice(inv.id)}
                    disabled={retrying === inv.id}
                    className="text-xs text-amber-400 hover:text-amber-300 underline disabled:opacity-50"
                  >
                    {retrying === inv.id ? 'Retrying…' : 'Retry'}
                  </button>
                )}
                <button
                  onClick={() => removeInvoice(inv.id)}
                  disabled={removing === inv.id}
                  className="text-gray-600 hover:text-red-400 text-xs disabled:opacity-50 transition-colors"
                  title="Remove this invoice and its alerts"
                >
                  {removing === inv.id ? 'Removing…' : 'Remove'}
                </button>
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