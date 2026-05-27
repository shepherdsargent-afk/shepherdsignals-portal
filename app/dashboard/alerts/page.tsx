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

  const overpriced = alerts.filter(a => a.alert_type === 'better_price_available')
  const good = alerts.filter(a => a.alert_type === 'good_price')
  const market = alerts.filter(a => a.alert_type === 'market_rate')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
        <p className="text-gray-400 mt-1">ShepherdSignals compares your invoice prices against current market rates</p>
      </div>

      {loading && (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-sm">Loading price intelligence...</p>
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-white font-medium">No alerts yet</p>
          <p className="text-gray-500 text-sm mt-2">Upload an invoice and ShepherdSignals will search current market prices and alert you to any savings opportunities</p>
          <a href="/dashboard/invoices" className="btn-primary inline-block mt-4 px-6 py-2 text-sm">Upload Invoice</a>
        </div>
      )}

      {overpriced.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">
            Savings Opportunities &mdash; {overpriced.length} item{overpriced.length > 1 ? 's' : ''} above market rate
          </h2>
          <div className="space-y-3">
            {overpriced.map((alert: any) => (
              <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
            ))}
          </div>
        </section>
      )}

      {market.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
            At Market Rate &mdash; {market.length} item{market.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">
            {market.map((alert: any) => (
              <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
            ))}
          </div>
        </section>
      )}

      {good.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">
            Good Prices &mdash; {good.length} item{good.length > 1 ? 's' : ''} below market
          </h2>
          <div className="space-y-3">
            {good.map((alert: any) => (
              <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AlertCard({ alert, onDismiss }: { alert: any; onDismiss: (id: string) => void }) {
  const isOverpriced = alert.alert_type === 'better_price_available'
  const isGood = alert.alert_type === 'good_price'
  const savingsPct = Math.abs(Number(alert.savings_pct ?? 0))
  const yourPrice = Number(alert.your_unit_price ?? 0)
  const marketPrice = Number(alert.market_unit_price ?? 0)
  const savingsPerUnit = Math.abs(Number(alert.savings_per_unit ?? (yourPrice - marketPrice)))

  return (
    <div className="card group relative">
      <div className="flex items-start gap-4">
        <div className={`w-1 self-stretch rounded-full shrink-0 ${
          isOverpriced ? 'bg-red-500' : isGood ? 'bg-green-500' : 'bg-yellow-500'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-white font-semibold text-base">{alert.item_description}</p>
              {alert.category && (
                <span className="text-xs bg-white/5 text-gray-500 px-2 py-0.5 rounded capitalize mt-1 inline-block">{alert.category}</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className={`text-2xl font-bold tabular-nums ${isOverpriced ? 'text-red-400' : isGood ? 'text-green-400' : 'text-yellow-400'}`}>
                {isOverpriced ? '-' : isGood ? '+' : ''}{savingsPct.toFixed(0)}%
              </p>
              <p className="text-gray-600 text-xs">{format(new Date(alert.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-3 flex-wrap">
            <div>
              <p className="text-gray-500 text-xs mb-0.5">You paid</p>
              <p className="text-white font-semibold text-base tabular-nums">${yourPrice.toFixed(2)}<span className="text-gray-500 text-xs font-normal"> /unit</span></p>
            </div>
            <div className="text-gray-600 text-sm">vs</div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Market rate</p>
              <p className={`font-semibold text-base tabular-nums ${isOverpriced ? 'text-green-400' : isGood ? 'text-red-400' : 'text-yellow-400'}`}>
                ${marketPrice.toFixed(2)}<span className="text-gray-500 text-xs font-normal"> /unit</span>
              </p>
            </div>
            {savingsPerUnit > 0.01 && (
              <div>
                <p className="text-gray-500 text-xs mb-0.5">{isOverpriced ? 'Could save' : 'Saving'}</p>
                <p className={`font-semibold text-base tabular-nums ${isOverpriced ? 'text-red-400' : 'text-green-400'}`}>
                  ${savingsPerUnit.toFixed(2)}/unit
                </p>
              </div>
            )}
          </div>

          {alert.suggested_vendor && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <p className="text-gray-400 text-sm">
                {isOverpriced ? 'Better price at:' : 'Found at:'} <span className="text-white font-medium">{alert.suggested_vendor}</span>
                {alert.market_source && alert.market_source !== alert.suggested_vendor && (
                  <span className="text-gray-600 text-xs"> via {alert.market_source}</span>
                )}
              </p>
              {alert.vendor_website && (
                <a
                  href={alert.vendor_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-mid/40 text-brand-light hover:bg-brand-mid/60 transition-colors font-medium"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Visit supplier
                </a>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => onDismiss(alert.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-gray-400 shrink-0 p-1 rounded mt-0.5"
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}