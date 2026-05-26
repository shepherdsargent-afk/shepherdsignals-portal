import { createServerSupabaseClient } from '@/lib/supabase-server'
import { format } from 'date-fns'

export default async function AdminPage() {
  const supabase = createServerSupabaseClient()

  const [companiesRes, alertsRes, invoicesRes, emailsRes] = await Promise.all([
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('price_alerts').select('id', { count: 'exact' }).eq('is_read', false),
    supabase.from('invoices').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(10),
  ])

  const companies = companiesRes.data ?? []
  const unreadAlerts = alertsRes.count ?? 0
  const pendingInvoices = invoicesRes.count ?? 0
  const recentEmails = emailsRes.data ?? []

  const statusColor: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    trial: 'text-yellow-400 bg-yellow-400/10',
    inactive: 'text-gray-500 bg-gray-500/10',
  }

  const planLabel: Record<string, string> = {
    daily: '📅 Daily',
    weekly: '📆 Weekly',
    both: '🔁 Both',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
        <p className="text-gray-400 mt-1">All clients, alerts, and activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card"><p className="text-gray-400 text-xs mb-1">Total Clients</p><p className="text-2xl font-bold text-white">{companies.length}</p></div>
        <div className="card"><p className="text-gray-400 text-xs mb-1">Active</p><p className="text-2xl font-bold text-green-400">{companies.filter(c => c.status === 'active').length}</p></div>
        <div className="card"><p className="text-gray-400 text-xs mb-1">Unread Alerts</p><p className="text-2xl font-bold text-orange-400">{unreadAlerts}</p></div>
        <div className="card"><p className="text-gray-400 text-xs mb-1">Pending Invoices</p><p className="text-2xl font-bold text-yellow-400">{pendingInvoices}</p></div>
      </div>

      {/* Companies Table */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">All Companies</h2>
          <a href="/admin/companies" className="text-sm text-brand-light hover:underline">Manage →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-white/5">
                <th className="text-left pb-3 pr-4">Company</th>
                <th className="text-left pb-3 pr-4">Contact</th>
                <th className="text-left pb-3 pr-4">Plan</th>
                <th className="text-left pb-3 pr-4">Status</th>
                <th className="text-left pb-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {companies.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="text-white font-medium">{c.name}</p>
                    <p className="text-gray-600 text-xs">{c.city}{c.city && c.state ? ', ' : ''}{c.state}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-gray-300">{c.contact_name ?? '—'}</p>
                    {c.contact_email && <p className="text-gray-600 text-xs">{c.contact_email}</p>}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{planLabel[c.plan] ?? c.plan}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColor[c.status] ?? ''}`}>{c.status}</span>
                  </td>
                  <td className="py-3 text-gray-500 text-xs">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-gray-600">No companies yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Emails */}
      <div className="card">
        <h2 className="text-white font-semibold mb-4">Recent Emails Sent</h2>
        {recentEmails.length > 0 ? (
          <div className="space-y-2">
            {recentEmails.map((e: any) => (
              <div key={e.id} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
                <span className="text-lg">{e.email_type === 'daily_signal' ? '📅' : e.email_type === 'weekly_audit' ? '📊' : '📬'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{e.subject ?? e.email_type}</p>
                  <p className="text-gray-600 text-xs">{e.recipient_email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'delivered' ? 'text-green-400 bg-green-400/10' : e.status === 'failed' ? 'text-red-400 bg-red-400/10' : 'text-gray-400 bg-gray-400/10'}`}>{e.status}</span>
                  <p className="text-gray-600 text-xs mt-0.5">{format(new Date(e.sent_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm text-center py-6">No emails sent yet</p>
        )}
      </div>
    </div>
  )
}
