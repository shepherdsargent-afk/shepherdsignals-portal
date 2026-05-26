'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const [company, setCompany] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [plan, setPlan] = useState('weekly')
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
        setCompany(cu.companies)
        setPlan((cu.companies as any).plan ?? 'weekly')
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
              <p className="text-white mt-0.5">{user?.email ?? '—'}</p>
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
            {[
              { value: 'daily', label: 'Daily Signals', desc: 'Get a price change summary every morning with notable movements from your vendors' },
              { value: 'weekly', label: 'Weekly Audit', desc: 'Receive a full weekly audit every Monday with trends, comparisons, and savings opportunities' },
              { value: 'both', label: 'Both', desc: 'Daily signals + the full weekly audit — stay on top of everything' },
            ].map(option => (
              <label key={option.value} className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${plan === option.value ? 'border-brand-light/40 bg-brand-mid/20' : 'border-white/5 hover:border-white/10'}`}>
                <input
                  type="radio"
                  name="plan"
                  value={option.value}
                  checked={plan === option.value}
                  onChange={() => setPlan(option.value)}
                  className="mt-1 accent-green-400"
                />
                <div>
                  <p className="text-white font-medium">{option.label}</p>
                  <p className="text-gray-400 text-sm mt-0.5">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={handleSavePlan} disabled={saving} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Preference'}
            </button>
            {saved && <p className="text-green-400 text-sm">✅ Saved</p>}
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
