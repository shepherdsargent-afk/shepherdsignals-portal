import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function AlertsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  const companyId = companyUser?.company_id

  const { data: alerts } = await supabase
    .from('price_alerts')
    .select('*, products(name, category), vendors(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  const unread = alerts?.filter(a => !a.is_read) ?? []
  const read = alerts?.filter(a => a.is_read) ?? []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
        <p className="text-gray-400 mt-1">Price change notifications from your vendors</p>
      </div>

      {unread.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3">
            New - {unread.length} unread
          </h2>
          <div className="space-y-2">
            {unread.map((alert: any) => <AlertRow key={alert.id} alert={alert} isNew />)}
          </div>
        </section>
      )}

      {read.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Earlier</h2>
          <div className="space-y-2">
            {read.map((alert: any) => <AlertRow key={alert.id} alert={alert} />)}
          </div>
        </section>
      )}

      {(!alerts || alerts.length === 0) && (
        <div className="card text-center py-16">
          <p className="text-white font-medium">No alerts yet</p>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Alerts will appear here when Shepherd detects price changes across your invoices
          </p>
        </div>
      )}
    </div>
  )
}

function AlertRow({ alert, isNew }: { alert: any; isNew?: boolean }) {
  const isUp = alert.change_direction === 'up'
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${isNew ? 'bg-white/5 border-white/10' : 'border-transparent hover:bg-white/3'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${isUp ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
        {isUp ? '+' : '-'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white text-sm font-medium">
              {alert.products?.name ?? 'Product'}
              <span className="text-gray-500 font-normal"> via </span>
              {alert.vendors?.name ?? 'Vendor'}
            </p>
            <p className="text-gray-400 text-sm mt-0.5">{alert.message}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-lg font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
              {isUp ? '+' : ''}{alert.change_pct?.toFixed(1)}%
            </span>
            <p className="text-gray-600 text-xs mt-0.5">{format(new Date(alert.created_at), 'MMM d, h:mm a')}</p>
          </div>
        </div>
        {(alert.old_price || alert.new_price) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>Was: <strong className="text-gray-400">${alert.old_price?.toFixed(2)}</strong></span>
            <span>-></span>
            <span>Now: <strong className={isUp ? 'text-red-400' : 'text-green-400'}>${alert.new_price?.toFixed(2)}</strong></span>
          </div>
        )}
      </div>
    </div>
  )
}