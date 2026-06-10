import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

const mobileNav = [
  { href: '/dashboard/alerts',       label: 'Price Alerts',   desc: 'Flagged overcharges',           color: 'from-amber-500/20 to-amber-500/5',    border: 'border-amber-500/20',   icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { href: '/dashboard/invoices',     label: 'Invoices',       desc: 'Processed invoice history',     color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/dashboard/vendors',      label: 'Vendors',        desc: 'Suppliers and alternatives',    color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/dashboard/signals',      label: 'Market Signals', desc: 'Industry pricing intelligence', color: 'from-amber-500/20 to-amber-500/5',    border: 'border-amber-500/20',   icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' },
  { href: '/dashboard/integrations', label: 'Integrations',   desc: 'Connect accounting software',   color: 'from-amber-500/20 to-amber-500/5',    border: 'border-amber-500/20', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { href: '/dashboard/settings',     label: 'Settings',       desc: 'Account and plan',              color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20',   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

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
    supabase.from('price_alerts').select('id, alert_type, is_read').eq('company_id', companyId).eq('is_read', false),
    supabase.from('vendors').select('id').limit(100),
    supabase.from('market_signals').select('id').order('created_at', { ascending: false }).limit(100),
    supabase.from('invoices').select('id').eq('company_id', companyId).eq('status', 'processed'),
  ])

  const activeAlerts = alertsRes.data?.length ?? 0
  const savingsAlerts = alertsRes.data?.filter(a => a.alert_type === 'better_alternative').length ?? 0
  const vendorCount = vendorsRes.data?.length ?? 0
  const signalCount = signalsRes.data?.length ?? 0
  const invoiceCount = invoicesRes.data?.length ?? 0

  const { data: recentAlerts } = await supabase
    .from('price_alerts').select('*, products(name)').eq('company_id', companyId).eq('is_read', false)
    .order('created_at', { ascending: false }).limit(5)

  const { data: recentSignals } = await supabase
    .from('market_signals').select('*').order('published_at', { ascending: false }).limit(3)

  return (
    <div>
      {/* â”€â”€ MOBILE: Section navigation tiles â”€â”€ */}
      <div className="md:hidden p-4">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-white">{company?.name ?? 'Dashboard'}</h1>
          <p className="text-gray-500 text-sm">
            {savingsAlerts > 0 ? (
              <span className="text-amber-400">{savingsAlerts} alert{savingsAlerts !== 1 ? 's' : ''} need your attention</span>
            ) : 'Everything looks good'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mobileNav.map(s => (
            <a
              key={s.href}
              href={s.href}
              className={`relative flex flex-col p-4 rounded-2xl border bg-gradient-to-br ${s.color} ${s.border} active:scale-95 transition-transform`}
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <p className="text-white text-sm font-semibold leading-tight">{s.label}</p>
              <p className="text-white/50 text-xs mt-0.5 leading-tight">{s.desc}</p>
              {s.href === '/dashboard/alerts' && savingsAlerts > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-black text-[10px] font-bold">
                  {savingsAlerts}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* â”€â”€ DESKTOP: Stat cards + detail panels â”€â”€ */}
      <div className="hidden md:block p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{company?.name ?? 'Dashboard'}</h1>
          <p className="text-gray-400 mt-1">
            {company?.plan === 'both' ? 'Weekly + Daily Signals' : company?.plan === 'daily' ? 'Daily Signals' : 'Weekly Audit'} &bull;{' '}
            <span className={company?.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
              {company?.status === 'trial' ? 'Trial' : 'Active'}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Price Alerts"       value={activeAlerts}  sub={savingsAlerts > 0 ? `${savingsAlerts} savings opportunities` : 'All monitored'} urgent={savingsAlerts > 0} href="/dashboard/alerts"   icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} />
          <StatCard label="Vendors"            value={vendorCount}   sub="tracked suppliers"           href="/dashboard/vendors"  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
          <StatCard label="Market Signals"     value={signalCount}   sub="active intelligence"         href="/dashboard/signals"  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} />
          <StatCard label="Invoices Processed" value={invoiceCount}  sub="analysed by ShepherdSignals" href="/dashboard/invoices" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Price Alerts</h2>
              <a href="/dashboard/alerts" className="text-sm text-brand-light hover:underline">View all</a>
            </div>
            {recentAlerts && recentAlerts.length > 0 ? (
              <div className="space-y-2">
                {recentAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/3 hover:bg-white/5 transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${alert.alert_type === 'better_alternative' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{alert.products?.name ?? 'Price alert'}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {alert.alert_type === 'better_alternative'
                          ? 'Cheaper alternative found'
                          : `$${Number(alert.old_price ?? 0).toFixed(2)} → $${Number(alert.new_price ?? 0).toFixed(2)}`}
                      </p>
                    </div>
                    {alert.change_pct != null && (
                      <span className={`text-sm font-semibold shrink-0 ${alert.alert_type === 'better_alternative' ? 'text-green-400' : 'text-red-400'}`}>
                        {alert.alert_type === 'better_alternative' ? '-' : '+'}{Math.abs(Number(alert.change_pct)).toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p className="text-sm">No alerts yet &mdash; upload an invoice to get started</p>
                <a href="/dashboard/invoices" className="text-brand-light text-sm hover:underline mt-2 inline-block">Upload invoice</a>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Market Signals</h2>
              <a href="/dashboard/signals" className="text-sm text-brand-light hover:underline">View all</a>
            </div>
            {recentSignals && recentSignals.length > 0 ? (
              <div className="space-y-3">
                {recentSignals.map((signal: any) => (
                  <div key={signal.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${signal.impact_level === 'high' ? 'bg-red-400' : signal.impact_level === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{signal.title}</p>
                      {signal.summary && <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{signal.summary}</p>}
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