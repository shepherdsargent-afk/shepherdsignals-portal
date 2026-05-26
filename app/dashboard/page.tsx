import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get company
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id, role, companies(*)')
    .eq('user_id', user.id)
    .single()

  const company = (companyUser?.companies as any)
  const companyId = companyUser?.company_id

  // Stats
  const [alertsRes, vendorsRes, signalsRes, emailsRes] = await Promise.all([
    supabase.from('price_alerts').select('id, is_read', { count: 'exact' }).eq('company_id', companyId),
    supabase.from('company_vendors').select('id', { count: 'exact' }).eq('company_id', companyId),
    supabase.from('market_signals').select('id', { count: 'exact' }),
    supabase.from('email_log').select('sent_at').eq('company_id', companyId).order('sent_at', { ascending: false }).limit(1),
  ])

  const unreadAlerts = alertsRes.data?.filter(a => !a.is_read).length ?? 0
  const totalAlerts = alertsRes.count ?? 0
  const vendorCount = vendorsRes.count ?? 0
  const signalCount = signalsRes.count ?? 0
  const lastEmail = emailsRes.data?.[0]?.sent_at

  // Recent alerts
  const { data: recentAlerts } = await supabase
    .from('price_alerts')
    .select('*, products(name), vendors(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {company ? `${company.name}` : 'Dashboard'}
        </h1>
        <p className="text-gray-400 mt-1">
          {company?.plan === 'daily' ? 'Daily Signals Plan' : company?.plan === 'weekly' ? 'Weekly Audit Plan' : 'Daily + Weekly Plan'} •{' '}
          <span className={`${company?.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
            {company?.status === 'trial' ? '🔶 Trial' : '🟢 Active'}
          </span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🔔" label="Unread Alerts" value={unreadAlerts} sub={`${totalAlerts} total`} urgent={unreadAlerts > 0} />
        <StatCard icon="🤝" label="Active Vendors" value={vendorCount} sub="tracked vendors" />
        <StatCard icon="📡" label="Market Signals" value={signalCount} sub="this month" />
        <StatCard icon="📧" label="Last Email" value={lastEmail ? format(new Date(lastEmail), 'MMM d') : '—'} sub={lastEmail ? format(new Date(lastEmail), 'h:mm a') : 'No emails yet'} />
      </div>

      {/* Recent Price Alerts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent Price Alerts</h2>
          <a href="/dashboard/alerts" className="text-sm text-brand-light hover:underline">View all →</a>
        </div>

        {recentAlerts && recentAlerts.length > 0 ? (
          <div className="space-y-3">
            {recentAlerts.map((alert: any) => (
              <div key={alert.id} className={`flex items-start gap-4 p-3 rounded-lg ${!alert.is_read ? 'bg-white/5' : ''}`}>
                <span className="text-xl mt-0.5">{alert.change_direction === 'up' ? '📈' : '📉'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    {(alert.products as any)?.name ?? 'Product'} — {(alert.vendors as any)?.name ?? 'Vendor'}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">{alert.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold ${alert.change_direction === 'up' ? 'text-red-400' : 'text-green-400'}`}>
                    {alert.change_direction === 'up' ? '+' : ''}{alert.change_pct?.toFixed(1)}%
                  </span>
                  <p className="text-gray-600 text-xs">{format(new Date(alert.created_at), 'MMM d')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium text-gray-400">No alerts yet</p>
            <p className="text-sm mt-1">Price alerts will appear here as we monitor your vendors</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, urgent }: { icon: string; label: string; value: string | number; sub: string; urgent?: boolean }) {
  return (
    <div className={`card ${urgent ? 'border-orange-500/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <p className={`text-2xl font-bold ${urgent ? 'text-orange-400' : 'text-white'}`}>{value}</p>
          <p className="text-gray-600 text-xs mt-1">{sub}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}
