'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const [company, setCompany] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [plan, setPlan] = useState('weekly')
  const [dailyEnabled, setDailyEnabled] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const { data: cu } = await supabase
        .from('company_users')
        .select('*, companies(*)')
        .eq('user_id', user.id)
        .single()
      if (cu?.companies) {
        const c = cu.companies as any
        setCompany(c)
        // Normalise: treat 'daily' as 'weekly' since it is no longer a standalone option
        const p = c.plan ?? 'weekly'
        setPlan(p === 'daily' ? 'weekly' : p)
        setDailyEnabled(c.daily_signals_enabled ?? false)
      }
    }
    load()
  }, [])

  async function handleSavePlan() {
    if (!company) return
    setSaving(true)
    await supabase.from('companies').update({ plan }).eq('id', company.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const options = [
    {
      value: 'weekly',
      label: 'Weekly Audit',
      desc: 'Full weekly audit every Monday - trends, comparisons, and savings opportunities',
      paid: false,
    },
    {
      value: 'both',
      label: 'Weekly + Daily Signals',
      desc: 'Weekly audit plus a daily price change summary every morning from your vendors',
      paid: true,
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and notification preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Account Info */}
        <div className="card">
          <h2 className="text-white font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Email</label>
              <p className="text-white mt-0.5">{user?.email ?? 'â€”'}</p>
            </div>
            {company && (
              <>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Company</label>
                  <p className="text-white mt-0.5">{company.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                  <p className="text-white mt-0.5 capitalize">{company.status}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Email Plan */}
        <div className="card">
          <h2 className="text-white font-semibold mb-1">Email Notifications</h2>
          <p className="text-gray-500 text-sm mb-5">Choose how often you receive price intelligence emails</p>
          <div className="space-y-3">
            {options.map(option => {
              const locked = option.paid && !dailyEnabled
              const selected = plan === option.value
              return (
                <label
                  key={option.value}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                    locked
                      ? 'border-white/5 opacity-60 cursor-not-allowed'
                      : selected
                      ? 'border-brand-light/40 bg-brand-mid/20 cursor-pointer'
                      : 'border-white/5 hover:border-white/10 cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={option.value}
                    checked={selected}
                    disabled={locked}
                    onChange={() => !locked && setPlan(option.value)}
                    className="mt-1 accent-green-400"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{option.label}</p>
                      {option.paid && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dailyEnabled ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                          {dailyEnabled ? 'Active' : '$199/mo add-on'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-0.5">{option.desc}</p>
                    {locked && (
                      <p className="text-yellow-400/80 text-xs mt-1.5">
                        Contact{' '}
                        <a href="mailto:shepherdsargent@shepherdsignals.com" className="underline hover:text-yellow-300">
                          shepherdsargent@shepherdsignals.com
                        </a>{' '}
                        to add Daily Signals for $199/mo
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={handleSavePlan} disabled={saving} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Preference'}
            </button>
            {saved && <p className="text-green-400 text-sm">Saved</p>}
          </div>
        </div>

        {/* Support */}
        <div className="card">
          <h2 className="text-white font-semibold mb-2">Support</h2>
          <p className="text-gray-400 text-sm">
            Need help or want to update your vendor list?{' '}
            <a href="mailto:shepherdsargent@shepherdsignals.com" className="text-brand-light hover:underline">
              Email Shepherd directly
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}