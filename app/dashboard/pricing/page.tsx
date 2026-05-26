import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function PricingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  const companyId = companyUser?.company_id

  const { data: records } = await supabase
    .from('price_records')
    .select('*, products(name, category), vendors(name)')
    .eq('company_id', companyId)
    .order('invoice_date', { ascending: false })
    .limit(100)

  // Group by product
  const byProduct: Record<string, any[]> = {}
  records?.forEach(r => {
    const key = r.products?.name ?? 'Unknown'
    if (!byProduct[key]) byProduct[key] = []
    byProduct[key].push(r)
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Price History</h1>
        <p className="text-gray-400 mt-1">Historical pricing data from your invoices</p>
      </div>

      {Object.keys(byProduct).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(byProduct).map(([productName, rows]) => {
            const latest = rows[0]
            const prev = rows[1]
            const change = prev ? ((latest.price - prev.price) / prev.price) * 100 : null
            return (
              <div key={productName} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold">{productName}</h3>
                    <p className="text-gray-500 text-xs capitalize">{latest.products?.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-xl">${latest.price.toFixed(2)}</p>
                    <p className="text-gray-500 text-xs">per {latest.unit}</p>
                    {change !== null && (
                      <p className={`text-xs font-medium ${change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs prev
                      </p>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-600 text-xs border-b border-white/5">
                        <th className="text-left pb-2 pr-4">Date</th>
                        <th className="text-left pb-2 pr-4">Vendor</th>
                        <th className="text-left pb-2 pr-4">Invoice #</th>
                        <th className="text-right pb-2">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/3">
                      {rows.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2 pr-4 text-gray-400">{format(new Date(r.invoice_date), 'MMM d, yyyy')}</td>
                          <td className="py-2 pr-4 text-gray-300">{r.vendors?.name}</td>
                          <td className="py-2 pr-4 text-gray-600">{r.invoice_number ?? '—'}</td>
                          <td className="py-2 text-right text-white font-medium">${r.price.toFixed(2)}<span className="text-gray-600 font-normal text-xs">/{r.unit}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📈</div>
          <p className="text-white font-medium">No price records yet</p>
          <p className="text-gray-500 text-sm mt-2">Upload your invoices and we'll extract the pricing data</p>
          <a href="/dashboard/invoices" className="btn-primary inline-block mt-4 px-6 py-2">Upload Invoices</a>
        </div>
      )}
    </div>
  )
}
