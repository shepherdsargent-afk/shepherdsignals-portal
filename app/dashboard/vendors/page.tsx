import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

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

  const { data: companyVendors } = await supabase
    .from('company_vendors')
    .select('*, vendors(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  const { data: alternatives } = await supabase
    .from('vendor_alternatives')
    .select('*, products(name), current_vendor:vendors!vendor_alternatives_current_vendor_id_fkey(name), alternative_vendor:vendors!vendor_alternatives_alternative_vendor_id_fkey(name)')
    .eq('company_id', companyId)
    .order('savings_pct', { ascending: false })
    .limit(5)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Vendors</h1>
        <p className="text-gray-400 mt-1">Your active vendors and alternative options</p>
      </div>

      {/* Active Vendors */}
      <div className="card mb-6">
        <h2 className="text-white font-semibold mb-4">Your Vendors ({companyVendors?.length ?? 0})</h2>
        {companyVendors && companyVendors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left pb-3 pr-4">Vendor</th>
                  <th className="text-left pb-3 pr-4">Category</th>
                  <th className="text-left pb-3 pr-4">Rep</th>
                  <th className="text-left pb-3">Account #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {companyVendors.map((cv: any) => (
                  <tr key={cv.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-brand-mid/50 flex items-center justify-center text-xs">
                          {cv.vendors?.name?.[0]}
                        </div>
                        <div>
                          <p className="text-white font-medium">{cv.vendors?.name}</p>
                          {cv.vendors?.website && (
                            <a href={cv.vendors.website} target="_blank" rel="noopener noreferrer" className="text-gray-600 text-xs hover:text-brand-light">
                              {cv.vendors.website.replace('https://', '')}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-400 capitalize">{cv.vendors?.category ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {cv.rep_name ? (
                        <div>
                          <p className="text-gray-300">{cv.rep_name}</p>
                          {cv.rep_email && <p className="text-gray-600 text-xs">{cv.rep_email}</p>}
                        </div>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="py-3 text-gray-400">{cv.account_number ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-3">🤝</div>
            <p>No vendors added yet</p>
            <p className="text-sm mt-1">Contact Shepherd to add your vendors</p>
          </div>
        )}
      </div>

      {/* Alternatives */}
      {alternatives && alternatives.length > 0 && (
        <div className="card">
          <h2 className="text-white font-semibold mb-1">💡 Vendor Alternatives</h2>
          <p className="text-gray-500 text-sm mb-4">Potential savings Shepherd identified for you</p>
          <div className="space-y-3">
            {alternatives.map((alt: any) => (
              <div key={alt.id} className="flex items-center gap-4 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="text-2xl">💰</div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{alt.products?.name}</p>
                  <p className="text-gray-400 text-xs">
                    Switch from <strong>{(alt.current_vendor as any)?.name}</strong> → <strong className="text-green-400">{(alt.alternative_vendor as any)?.name}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">Save {alt.savings_pct?.toFixed(1)}%</p>
                  {alt.current_price && alt.alternative_price && (
                    <p className="text-gray-600 text-xs">
                      ${alt.current_price.toFixed(2)} → ${alt.alternative_price.toFixed(2)}
                    </p>
                  )}
                </div>
                {!alt.verified && <span className="text-xs text-gray-600 bg-white/5 px-2 py-1 rounded">Unverified</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
