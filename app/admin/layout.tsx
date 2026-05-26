import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Only Shepherd's email gets admin access
  const adminEmail = process.env.SHEPHERD_ADMIN_EMAIL ?? 'shepherdsargent@shepherdsignals.com'
  if (user.email !== adminEmail) redirect('/dashboard')

  return (
    <div className="flex min-h-screen bg-[#0a1f18]">
      {/* Admin Sidebar */}
      <aside className="w-64 min-h-screen bg-brand-dark border-r border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-mid flex items-center justify-center text-base">🐑</div>
            <div>
              <div className="text-white font-bold text-sm">Shepherd Admin</div>
              <div className="text-gray-500 text-xs">ShepherdSignals HQ</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { href: '/admin', label: 'Overview', icon: '📊' },
            { href: '/admin/companies', label: 'Companies', icon: '🏢' },
            { href: '/admin/signals', label: 'Add Signal', icon: '📡' },
            { href: '/dashboard', label: '← Client View', icon: '👁' },
          ].map(item => (
            <a key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <span>{item.icon}</span><span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
