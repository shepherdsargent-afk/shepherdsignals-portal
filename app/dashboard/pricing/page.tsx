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

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, vendors(name)')
    .eq('company_id', companyId)
    .eq('status', 'processed')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Price History</h1>
        <p className="text-gray-400 mt-1">Invoice pricing data extracted by Shepherd</p>
      </div>

      {invoices && invoices.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-white/5 text-xs uppercase tracking-wide">
                <th className="text-left pb-3 pr-4">Invoice #</th>
                <th className="text-left pb-3 pr-4">Vendor</th>
                <th className="text-left pb-3 pr-4">Date</th>
                <th className="text-right pb-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-3 pr-4 text-gray-300">{inv.invoice_number ?? 'â€”'}</td>
                  <td className="py-3 pr-4 text-white font-medium">{inv.vendors?.name ?? 'â€”'}</td>
                  <td className="py-3 pr-4 text-gray-400">
                    {inv.invoice_date
                      ? format(new Date(inv.invoice_date), 'MMM d, yyyy')
                      : format(new Date(inv.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 text-right font-bold">
                    {inv.total_amount
                      ? <span className="text-white">${Number(inv.total_amount).toFixed(2)}</span>
                      : <span className="text-gray-600">â€”</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-white font-medium">No price history yet</p>
          <p className="text-gray-500 text-sm mt-2">Upload invoices and Shepherd will extract the pricing data</p>
          <a href="/dashboard/invoices" className="btn-primary inline-block mt-4 px-6 py-2">Upload Invoices</a>
        </div>
      )}
    </div>
  )
}