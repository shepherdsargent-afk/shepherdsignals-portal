import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function VendorsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  const companyId = companyUser?.company_id

  const { data: invoices } = await supabase
    .from('invoices')
    .select('vendor_id, total_amount, created_at, vendors(id, name)')
    .eq('company_id', companyId)
    .eq('status', 'processed')
    .not('vendor_id', 'is', null)
    .order('created_at', { ascending: false })

  // Group by vendor
  const vendorMap: Record<string, { name: string; count: number; lastDate: string; total: number }> = {}
  invoices?.forEach((inv: any) => {
    const id = inv.vendor_id
    const name = inv.vendors?.name ?? 'Unknown'
    if (!vendorMap[id]) vendorMap[id] = { name, count: 0, lastDate: inv.created_at, total: 0 }
    vendorMap[id].count++
    vendorMap[id].total += Number(inv.total_amount ?? 0)
  })
  const vendors = Object.values(vendorMap)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Vendors</h1>
        <p className="text-gray-400 mt-1">Vendors identified from your invoices</p>
      </div>

      <div className="card">
        <h2 className="text-white font-semibold mb-4">Active Vendors ({vendors.length})</h2>
        {vendors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/5 text-xs uppercase tracking-wide">
                  <th className="text-left pb-3 pr-4">Vendor</th>
                  <th className="text-left pb-3 pr-4">Invoices</th>
                  <th className="text-left pb-3 pr-4">Last Invoice</th>
                  <th className="text-right pb-3">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vendors.map((v: any) => (
                  <tr key={v.name} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-brand-mid/50 flex items-center justify-center text-xs font-bold text-white">
                          {v.name[0]}
                        </div>
                        <p className="text-white font-medium">{v.name}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{v.count}</td>
                    <td className="py-3 pr-4 text-gray-400">{format(new Date(v.lastDate), 'MMM d, yyyy')}</td>
                    <td className="py-3 text-right text-white font-medium">
                      {v.total > 0 ? `$${v.total.toFixed(2)}` : 'â€”'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <p>No vendors yet</p>
            <p className="text-sm mt-1">Vendors will appear here once invoices are processed</p>
          </div>
        )}
      </div>
    </div>
  )
}