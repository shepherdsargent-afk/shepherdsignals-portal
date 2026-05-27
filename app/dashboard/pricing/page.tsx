'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

export default function PricingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) return
    const { data } = await supabase
      .from('invoices')
      .select('*, vendors(name)')
      .eq('company_id', cu.company_id)
      .eq('status', 'processed')
      .order('created_at', { ascending: false })
    setInvoices(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleDelete(inv: any) {
    if (!confirm('Remove this entry from price history?')) return
    if (inv.file_url) {
      const match = inv.file_url.match(/\/object\/(?:public|sign)\/invoices\/(.+)/)
      if (match) await supabase.storage.from('invoices').remove([decodeURIComponent(match[1])])
    }
    await supabase.from('invoices').delete().eq('id', inv.id)
    setInvoices(prev => prev.filter(i => i.id !== inv.id))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Price History</h1>
        <p className="text-gray-400 mt-1">Invoice pricing data extracted by ShepherdSignals</p>
      </div>

      {invoices.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-white/5 text-xs uppercase tracking-wide">
                <th className="text-left pb-3 pr-4">Invoice #</th>
                <th className="text-left pb-3 pr-4">Vendor</th>
                <th className="text-left pb-3 pr-4">Date</th>
                <th className="text-right pb-3 pr-4">Total</th>
                <th className="pb-3 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-white/3 transition-colors group">
                  <td className="py-3 pr-4 text-gray-300">{inv.invoice_number ?? 'â€”'}</td>
                  <td className="py-3 pr-4 text-white font-medium">{inv.vendors?.name ?? 'â€”'}</td>
                  <td className="py-3 pr-4 text-gray-400">
                    {inv.invoice_date
                      ? format(new Date(inv.invoice_date), 'MMM d, yyyy')
                      : format(new Date(inv.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 pr-4 text-right font-bold">
                    {inv.total_amount ? <span className="text-white">${Number(inv.total_amount).toFixed(2)}</span> : <span className="text-gray-600">â€”</span>}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => handleDelete(inv)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 p-1 rounded"
                      title="Remove"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-white font-medium">No price history yet</p>
          <p className="text-gray-500 text-sm mt-2">Upload invoices and ShepherdSignals will extract the pricing data</p>
          <a href="/dashboard/invoices" className="btn-primary inline-block mt-4 px-6 py-2">Upload Invoices</a>
        </div>
      )}
    </div>
  )
}