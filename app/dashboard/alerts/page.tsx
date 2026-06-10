'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) return
    const { data } = await supabase
      .from('price_alerts')
      .select('*, products(name, unit), vendors(name)')
      .eq('company_id', cu.company_id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50)
    setAlerts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function dismiss(id: string) {
    await supabase.from('price_alerts').update({ is_read: true }).eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  function exportToExcel() {
    const BOM = '﻿'
    const headers = ['Item', 'Vendor', 'Change %', 'Old Price ($)', 'New Price ($)', 'Type', 'Details', 'Date']
    const rows = alerts.map(a => [
      `"${(a.products?.name ?? '').replace(/"/g, '""')}"`,
      `"${(a.vendors?.name ?? '').replace(/"/g, '""')}"`,
      `${a.change_direction === 'down' ? '-' : '+'}${Number(a.change_pct ?? 0).toFixed(1)}%`,
      Number(a.old_price ?? 0).toFixed(2),
      Number(a.new_price ?? 0).toFixed(2),
      a.alert_type === 'better_alternative' ? 'Savings Opportunity' : 'Price Increase',
      `"${(a.message ?? '').replace(/"/g, '""')}"`,
      a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd') : '',
    ].join(','))
    const csv = BOM + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shepherdsignals-alerts-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const increases = alerts.filter(a => a.alert_type === 'price_change')
  const savings = alerts.filter(a => a.alert_type === 'better_alternative')
  const other = alerts.filter(a => a.alert_type !== 'price_change' && a.alert_type !== 'better_alternative')

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
          <p className="text-gray-400 mt-1">ShepherdSignals flags price increases the moment your invoices are processed</p>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export to Excel
          </button>
        )}
      </div>

      {loading && <div className="card text-center py-16"><p className="text-gray-500">Loading price intelligence...</p></div>}

      {!loading && alerts.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-white font-medium">No alerts yet</p>
          <p className="text-gray-500 text-sm mt-2">Upload an invoice and ShepherdSignals will compare every line item against your price history and flag any increases</p>
          <a href="/dashboard/invoices" className="btn-primary inline-block mt-4 px-6 py-2">Upload Invoice</a>
        </div>
      )}

      {increases.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">
            Price Increases &mdash; {increases.length} item{increases.length > 1 ? 's' : ''} flagged
          </h2>
          <div className="space-y-3">{increases.map((a: any) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}</div>
        </section>
      )}
      {savings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">
            Savings Opportunities &mdash; {savings.length} verified alternative{savings.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">{savings.map((a: any) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}</div>
        </section>
      )}
      {other.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
            Market Signals &mdash; {other.length}
          </h2>
          <div className="space-y-3">{other.map((a: any) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}</div>
        </section>
      )}
    </div>
  )
}

function AlertCard({ alert, onDismiss }: { alert: any; onDismiss: (id: string) => void }) {
  const isSaving = alert.alert_type === 'better_alternative'
  const pct = Number(alert.change_pct ?? 0)
  const oldPrice = Number(alert.old_price ?? 0)
  const newPrice = Number(alert.new_price ?? 0)

  return (
    <div className={`card group relative border-l-4 ${isSaving ? 'border-l-green-500' : 'border-l-red-500'}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-white font-semibold">{alert.products?.name ?? 'Product'}</p>
              {alert.vendors?.name && (
                <span className="text-xs bg-white/5 text-gray-500 px-2 py-0.5 rounded mt-1 inline-block">{alert.vendors.name}</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className={`text-xl font-bold tabular-nums ${isSaving ? 'text-green-400' : 'text-red-400'}`}>
                {isSaving ? '-' : '+'}{Math.abs(pct).toFixed(1)}%
              </span>
              <p className="text-gray-600 text-xs mt-0.5">{alert.created_at ? format(new Date(alert.created_at), 'MMM d, yyyy') : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-3 text-sm flex-wrap">
            <div>
              <p className="text-gray-500 text-xs mb-0.5">{isSaving ? 'You pay' : 'Was'}</p>
              <p className="text-white font-semibold tabular-nums">${oldPrice.toFixed(2)}</p>
            </div>
            <div className="text-gray-600 text-xs">→</div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">{isSaving ? 'Alternative' : 'Now'}</p>
              <p className={`font-semibold tabular-nums ${isSaving ? 'text-green-400' : 'text-red-400'}`}>${newPrice.toFixed(2)}</p>
            </div>
          </div>

          {alert.message && (
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">{alert.message}</p>
          )}
        </div>

        <button
          onClick={() => onDismiss(alert.id)}
          className="text-gray-600 hover:text-white text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Dismiss alert"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
