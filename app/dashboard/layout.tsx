import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('companies(*)')
    .eq('user_id', user.id)
    .single()

  const company = companyUser?.companies as any

  const nav = [
    { href: '/dashboard',              label: 'Overview',       icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/dashboard/alerts',       label: 'Alerts',         icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { href: '/dashboard/invoices',     label: 'Invoices',       icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/dashboard/vendors',      label: 'Vendors',        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/dashboard/settings',     label: 'Settings',       icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]

  // Full nav for sidebar (desktop)
  const fullNav = [
    ...nav.slice(0, 2),
    { href: '/dashboard/signals',      label: 'Market Signals', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' },
    nav[2],
    { href: '/dashboard/integrations', label: 'Integrations',   icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    nav[3],
    nav[4],
  ]

  const initials = company?.name
    ? company.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'SS'

  function PlanBadge({ plan }: { plan: string }) {
    if (plan === 'annual')  return <span className="text-xs text-white">Annual Plan</span>
    if (plan === 'monthly') return <span className="text-xs text-white">Monthly Plan</span>
    if (plan === 'both')    return <span className="text-xs text-white">Weekly + Daily</span>
    if (plan === 'daily')   return <span className="text-xs text-white">Daily Plan</span>
    if (plan === 'weekly')  return <span className="text-xs text-white">Weekly Plan</span>
    return <span className="text-xs text-gray-500">-</span>
  }

  return (
    <div className="flex h-screen bg-[#080d1a] overflow-hidden">

      {/* â”€â”€ Desktop sidebar (hidden on mobile) â”€â”€ */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-[#0a0f1e] border-r border-white/5">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-amber-400 text-sm font-bold">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{company?.name ?? 'Dashboard'}</p>
              <PlanBadge plan={company?.plan ?? ''} />
            </div>
          </div>
          <p className="text-amber-400/80 text-[10px] font-semibold tracking-widest uppercase mt-3">ShepherdSignals</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {fullNav.map(item => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${company?.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-xs text-gray-500">{company?.status === 'active' ? 'Active' : 'Trial'}</span>
            </div>
            <Link href="/dashboard/settings" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">Settings</Link>
          </div>
        </div>
      </aside>

      {/* â”€â”€ Content area â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar (hidden on desktop) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0a0f1e] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-8 h-8 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-amber-400 text-xs font-bold">{initials}</span>
              </div>
            )}
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{company?.name ?? 'Dashboard'}</p>
              <PlanBadge plan={company?.plan ?? ''} />
            </div>
          </div>
          <p className="text-amber-400/70 text-[10px] font-semibold tracking-widest uppercase">ShepherdSignals</p>
        </header>

        {/* Main scrollable content â€” pb-20 on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* â”€â”€ Mobile bottom nav (hidden on desktop) â”€â”€ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0f1e] border-t border-white/10 flex z-50">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          ))}
        </nav>

      </div>
    </div>
  )
}