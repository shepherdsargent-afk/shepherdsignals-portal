import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id, role, companies(*)')
    .eq('user_id', user.id)
    .single()

  const company = (companyUser?.companies as any)
  const companyId = companyUser?.company_id

  const [alertsRes, vendorsRes, signalsRes, invoicesRes] = await Promise.all([
    supabase.from('price_alerts').select('id, alert_type, dismissed').eq('company_id', companyId).eq('dismissed', false),
    supabase.from('vendors').select('id').limit(100),
    supabase.from('market_signals').select('id').order('created_at', { ascending: false }).limit(100),
    supabase.from('invoices').select('id').eq('company_id', companyId).eq('status', 'processed'),
  ])

  const activeAlerts = alertsRes.data?.length ?? 0
  const savingsAlerts = alertsRes.data?.filter(a => a.alert_type === 'better_price_available').length ?? 0
  const vendorCount = vendorsRes.data?.length ?? 0
  const signalCount = signalsRes.data?.length ?? 0
  const invoiceCount = invoicesRes.data?.length ?? 0

  const { data: recentAlerts } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('company_id', companyId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentSignals } = await supabase
    .from('market_signals')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(3)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {company?.name ?? 'Dashboard'}
        </h1>
        <p className="text-gray-400 mt-1">
          {company?.plan === 'both' ? 'Weekly + Daily Signals' : 'Weekly Audit'} &bull;{' '}
          <span className={company?.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
            {company?.status === 'trial' ? 'Trial' : 'Active'}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Price Alerts"
          value={activeAlerts}
          sub={savingsAlerts > 0 ? `${savingsAlerts} savings opportunities` : 'All monitored'}
          urgent={savingsAlerts > 0}
          href="/dashboard/alerts"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
        <StatCard
          label="Vendors"
          value={vendorCount}
          sub="tracked suppliers"
          href="/dashboard/vendors"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <StatCard
          label="Market Signals"
          value={signalCount}
          sub="active intelligence"
          href="/dashboard/signals"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <StatCard
          label="Invoices Processed"
          value={invoiceCount}
          sub="analysed by ShepherdSignals"
          href="/dashboard/invoices"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Price Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Price Alerts</h2>
            <a href="/dashboard/alerts" className="text-sm text-brand-light hover:underline">View all</a>
          </div>
          {recentAlerts && recentAlerts.length > 0 ? (
            <div className="space-y-2">
              {recentAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/3 hover:bg-white/5 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    alert.alert_type === 'better_price_available' ? 'bg-red-400' :
                    alert.alert_type === 'good_price' ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{alert.item_description}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {alert.alert_type === 'better_price_available'
                        ? `${alert.savings_pct?.toFixed(0) ?? '?'}% above market â€” check ${alert.suggested_vendor ?? 'alternatives'}`
                        : alert.alert_type === 'good_price' ? 'Below market rate'
                        : 'At market rate'}
                    </p>
                  </div>
                  {alert.savings_pct && (
                    <span className={`text-sm font-semibold shrink-0 ${
                      alert.alert_type === 'better_price_available' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {alert.alert_type === 'better_price_available' ? '-' : '+'}{Math.abs(alert.savings_pct).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p className="text-sm">No alerts yet â€” upload an invoice to get started</p>
              <a href="/dashboard/invoices" className="text-brand-light text-sm hover:underline mt-2 inline-block">Upload invoice</a>
            </div>
          )}
        </div>

        {/* Market Signals */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Market Signals</h2>
            <a href="/dashboard/signals" className="text-sm text-brand-light hover:underline">View all</a>
          </div>
          {recentSignals && recentSignals.length > 0 ? (
            <div className="space-y-3">
              {recentSignals.map((signal: any) => (
                <div key={signal.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    signal.impact_level === 'high' ? 'bg-red-400' :
                    signal.impact_level === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{signal.title}</p>
                    {signal.summary && (
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{signal.summary}</p>
                    )}
                    <p className="text-gray-600 text-xs mt-1">{signal.published_at ? format(new Date(signal.published_at), 'MMM d, yyyy') : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p className="text-sm">Signals appear after your first invoice is processed</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, urgent, href, icon }: {
  label: string; value: string | number; sub: string; urgent?: boolean; href?: string; icon?: React.ReactNode
}) {
  const content = (
    <div className={`card h-full transition-colors hover:border-white/10 ${urgent ? 'border-red-500/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${urgent ? 'text-red-400' : 'text-white'}`}>{value}</p>
      <p className={`text-xs mt-1 ${urgent ? 'text-red-400/70' : 'text-gray-500'}`}>{sub}</p>
    </div>
  )
  return href ? <a href={href}>{content}</a> : <div>{content}</div>
}