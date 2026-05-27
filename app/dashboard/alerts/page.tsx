'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

// Fallback URLs for well-known vendors (used when vendor_website is not stored)
const VENDOR_URLS: Record<string, string> = {
  amazon:              'https://www.amazon.ca',
  'amazon.ca':         'https://www.amazon.ca',
  'amazon canada':     'https://www.amazon.ca',
  sysco:               'https://www.sysco.ca',
  'gordon food service': 'https://www.gfs.com',
  gfs:                 'https://www.gfs.com',
  staples:             'https://www.staples.ca',
  costco:              'https://www.costco.ca',
  uline:               'https://www.uline.ca',
  webstaurantstore:    'https://www.webstaurantstore.com',
  'restaurant depot':  'https://www.restaurantdepot.com',
  grainger:            'https://www.grainger.ca',
  'home depot':        'https://www.homedepot.ca',
  totalpack:           'https://www.totalpack.ca',
  officecrave:         'https://www.officecrave.com',
  'global industrial': 'https://www.globalindustrial.ca',
}

function resolveVendorUrl(vendorName: string | null, storedUrl: string | null): string | null {
  if (storedUrl) return storedUrl
  if (!vendorName) return null
  const key = vendorName.toLowerCase().trim()
  for (const [k, v] of Object.entries(VENDOR_URLS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

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
      .select('*')
      .eq('company_id', cu.company_id)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(50)
    setAlerts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function dismiss(id: string) {
    await supabase.from('price_alerts').update({ dismissed: true }).eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  function exportToExcel() {
    const BOM = 'ï»¿'
    const headers = ['Item', 'Alert Type', 'Your Price ($/unit)', 'Market Price ($/unit)', 'Savings/Unit ($)', 'Savings %', 'Supplier', 'Supplier URL', 'Category', 'Date']
    const rows = alerts.map(a => {
      const type = a.alert_type === 'better_price_available' ? 'Savings Opportunity'
        : a.alert_type === 'good_price' ? 'Good Price' : 'Market Rate'
      return [
        `"${(a.item_description ?? '').replace(/"/g, '""')}"`,
        type,
        Number(a.your_unit_price ?? 0).toFixed(2),
        Number(a.market_unit_price ?? 0).toFixed(2),
        Math.abs(Number(a.savings_per_unit ?? 0)).toFixed(2),
        `${Math.abs(Number(a.savings_pct ?? 0)).toFixed(1)}%`,
        `"${(a.suggested_vendor ?? '').replace(/"/g, '""')}"`,
        resolveVendorUrl(a.suggested_vendor, a.vendor_website) ?? '',
        a.category ?? '',
        a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd') : '',
      ].join(',')
    })
    const csv = BOM + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shepherdsignals-alerts-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const overpriced = alerts.filter(a => a.alert_type === 'better_price_available')
  const good = alerts.filter(a => a.alert_type === 'good_price')
  const market = alerts.filter(a => a.alert_type === 'market_rate')

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
          <p className="text-gray-400 mt-1">ShepherdSignals compares your invoice prices against current market rates</p>
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
          <p className="text-gray-500 text-sm mt-2">Upload an invoice and ShepherdSignals will search current market prices and alert you to any savings opportunities</p>
          <a href="/dashboard/invoices" className="btn-primary inline-block mt-4 px-6 py-2">Upload Invoice</a>
        </div>
      )}

      {overpriced.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">
            Savings Opportunities &mdash; {overpriced.length} item{overpriced.length > 1 ? 's' : ''} above market rate
          </h2>
          <div className="space-y-3">{overpriced.map((a: any) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}</div>
        </section>
      )}
      {market.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
            At Market Rate &mdash; {market.length} item{market.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">{market.map((a: any) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}</div>
        </section>
      )}
      {good.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">
            Good Prices &mdash; {good.length} item{good.length > 1 ? 's' : ''} below market
          </h2>
          <div className="space-y-3">{good.map((a: any) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}</div>
        </section>
      )}
    </div>
  )
}

function AlertCard({ alert, onDismiss }: { alert: any; onDismiss: (id: string) => void }) {
  const isOverpriced = alert.alert_type === 'better_price_available'
  const isGood       = alert.alert_type === 'good_price'
  const savingsPct   = Math.abs(Number(alert.savings_pct ?? 0))
  const yourPrice    = Number(alert.your_unit_price ?? 0)
  const marketPrice  = Number(alert.market_unit_price ?? 0)
  const savingsPerUnit = Math.abs(Number(alert.savings_per_unit ?? (yourPrice - marketPrice)))
  const vendorUrl    = resolveVendorUrl(alert.suggested_vendor, alert.vendor_website)

  return (
    <div className={`card group relative border-l-4 ${isOverpriced ? 'border-l-red-500' : isGood ? 'border-l-green-500' : 'border-l-yellow-500'}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-white font-semibold">{alert.item_description}</p>
              {alert.category && (
                <span className="text-xs bg-white/5 text-gray-500 px-2 py-0.5 rounded capitalize mt-1 inline-block">{alert.category}</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className={`text-xl font-bold tabular-nums ${isOverpriced ? 'text-red-400' : isGood ? 'text-green-400' : 'text-yellow-400'}`}>
                {isOverpriced ? '-' : isGood ? '+' : ''}{savingsPct.toFixed(0)}%
              </span>
              <p className="text-gray-600 text-xs mt-0.5">{alert.created_at ? format(new Date(alert.created_at), 'MMM d, yyyy') : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-3 text-sm flex-wrap">
            <div>
              <p className="text-gray-500 text-xs mb-0.5">You paid</p>
              <p className="text-white font-semibold tabular-nums">${yourPrice.toFixed(2)}<span className="text-gray-500 text-xs font-normal"> /unit</span></p>
            </div>
            <div className="text-gray-600 text-xs">vs</div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Market rate</p>
              <p className={`font-semibold tabular-nums ${isOverpriced ? 'text-green-400' : isGood ? 'text-red-400' : 'text-yellow-400'}`}>
                ${marketPrice.toFixed(2)}<span className="text-gray-500 text-xs font-normal"> /unit</span>
              </p>
            </div>
            {savingsPerUnit > 0.01 && (
              <div>
                <p className="text-gray-500 text-xs mb-0.5">{isOverpriced ? 'Could save' : 'Saving'}</p>
                <p className={`font-semibold tabular-nums ${isOverpriced ? 'text-red-400' : 'text-green-400'}`}>
                  ${savingsPerUnit.toFixed(2)}/unit
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {vendorUrl ? (
              <a href={vendorUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
                {isOverpriced ? 'Buy cheaper at' : 'View at'} {alert.suggested_vendor}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ) : alert.suggested_vendor ? (
              <p className="text-gray-500 text-sm">
                {isOverpriced ? 'Check pricing at' : 'Found at'}: <span className="text-amber-400">{alert.suggested_vendor}</span>
              </p>
            ) : null}
            <button onClick={() => onDismiss(alert.id)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors ml-auto">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}