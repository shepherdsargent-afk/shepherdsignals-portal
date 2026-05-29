'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const [company, setCompany]   = useState<any>(null)
  const [user, setUser]         = useState<any>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved]       = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id, companies(*)')
        .eq('user_id', user.id)
        .single()
      if (!cu) return
      setCompanyId(cu.company_id)
      setCompany((cu as any).companies)
    }
    load()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !companyId) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${companyId}/logo.${ext}`
      const { error: uploadError } = await supabase.storage.from('company-logos').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('company-logos').getPublicUrl(path)
      await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', companyId)
      setCompany((prev: any) => ({ ...prev, logo_url: publicUrl }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveLogo() {
    if (!companyId) return
    await supabase.from('companies').update({ logo_url: null }).eq('id', companyId)
    setCompany((prev: any) => ({ ...prev, logo_url: null }))
  }

  async function handleUpgradeDailyAlerts() {
    setUpgrading(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'daily-addon', email: user?.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Something went wrong. Please try again.')
    } finally {
      setUpgrading(false)
    }
  }

  function planLabel(plan: string) {
    if (plan === 'annual')  return 'Annual Plan - $549/mo'
    if (plan === 'monthly') return 'Monthly Plan - $649/mo'
    if (plan === 'both')    return 'Weekly + Daily Alerts'
    if (plan === 'daily')   return 'Daily Alerts Plan'
    if (plan === 'weekly')  return 'Weekly Plan'
    return plan
  }

  const hasDailyAlerts = company?.plan === 'both' || company?.plan === 'daily'
  const initials = company?.name
    ? company.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'SS'

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and company preferences</p>
      </div>

      {/* Upgrade to Daily Alerts - only shown if not already on daily */}
      {company && !hasDailyAlerts && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">Available Upgrade</p>
              <h2 className="text-white font-semibold mb-1">Add Daily Alerts</h2>
              <p className="text-gray-400 text-sm">Get an immediate email the moment we process an invoice and find a price increase - not just in your Monday digest.</p>
              <p className="text-amber-400 text-sm font-semibold mt-2">+$199/month added to your current plan</p>
            </div>
            <button
              onClick={handleUpgradeDailyAlerts}
              disabled={upgrading}
              className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              {upgrading ? 'Redirecting...' : 'Add for $199/mo'}
            </button>
          </div>
        </div>
      )}

      {/* Company Logo */}
      <div className="card mb-6">
        <h2 className="text-white font-semibold mb-4">Company Logo</h2>
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company?.name} className="w-20 h-20 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-indigo-400 text-2xl font-bold">{initials}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-gray-300 text-sm mb-1">Your logo appears in the sidebar. Recommended: square image, min 200x200px.</p>
            <p className="text-gray-600 text-xs mb-3">PNG, JPG, WebP or SVG - Max 2MB</p>
            <div className="flex items-center gap-3">
              <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-white/5 text-gray-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    {company?.logo_url ? 'Change Logo' : 'Upload Logo'}
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
              {company?.logo_url && (
                <button onClick={handleRemoveLogo} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors">
                  Remove
                </button>
              )}
              {saved && (
                <span className="text-green-400 text-sm flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card mb-6">
        <h2 className="text-white font-semibold mb-4">Account</h2>
        <div className="space-y-3">
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="text-gray-200 text-sm">{user?.email ?? '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Company</p>
            <p className="text-gray-200 text-sm">{company?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Location</p>
            <p className="text-gray-200 text-sm">
              {[company?.city, company?.province, company?.country].filter(Boolean).join(', ') || '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Plan</p>
            <p className="text-gray-200 text-sm">{company?.plan ? planLabel(company.plan) : '-'}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="text-white font-semibold mb-4">Notifications</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <p className="text-gray-200 text-sm font-medium">Weekly Digest</p>
              <p className="text-gray-500 text-xs mt-0.5">Price alerts and market signals summary every Monday morning</p>
            </div>
            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">Active</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-gray-200 text-sm font-medium">Immediate Alerts</p>
              <p className="text-gray-500 text-xs mt-0.5">Email the moment a new invoice is processed and savings are found</p>
            </div>
            {hasDailyAlerts ? (
              <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">Active</span>
            ) : (
              <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors" onClick={handleUpgradeDailyAlerts}>
                Upgrade +$199
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}