import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get company name for sidebar
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('companies(name)')
    .eq('user_id', user.id)
    .single()

  const companyName = (companyUser?.companies as any)?.name

  return (
    <div className="flex min-h-screen bg-[#0a1f18]">
      <Sidebar companyName={companyName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
