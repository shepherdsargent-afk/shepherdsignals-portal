'use client'
import { useState } from 'react'
import Link from 'next/link'

function Check() {
  return (
    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$649',
    period: '/month',
    note: null,
    desc: 'Full procurement intelligence, billed monthly. Cancel anytime.',
    features: [
      'All vendor categories monitored',
      'Weekly digest every Monday morning',
      'Daily 6am intelligence brief',
      'Verified cheaper alternatives',
      'Portal access and reporting dashboard',
      'Onboarding invoice audit included',
    ],
    featured: false,
    badge: null,
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$549',
    period: '/month',
    note: '$6,588 billed annually - save $1,200',
    desc: 'Everything in Monthly, plus dedicated support and quarterly reviews.',
    features: [
      'Everything in Monthly',
      'Priority override response',
      'Quarterly procurement review call',
      'Vendor negotiation support',
      'Accounting software integrations',
      'Early access to new features',
    ],
    featured: true,
    badge: 'Most popular - Best value',
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  async function startCheckout(planId: string) {
    setLoading(planId)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setError('Could not start checkout: ' + msg)
        setLoading('')
        return
      }
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        setError(json.error || 'Unexpected error. Please try again.')
        setLoading('')
      }
    } catch (e: any) {
      setError('Network error: ' + e.message)
      setLoading('')
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="text-center mb-10">
          <Link href="https://shepherdsignals.com" className="text-slate-400 hover:text-white text-sm mb-6 inline-block">
            Back to shepherdsignals.com
          </Link>
          <h1 className="text-3xl font-bold mb-2">Simple, transparent pricing</h1>
          <p className="text-slate-400">Procurement intelligence for golf clubs. Two months, or your money back.</p>
        </div>

        {error && (
          <p className="mb-6 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border flex flex-col p-6 ${
                plan.featured
                  ? 'border-emerald-500 bg-emerald-950/30'
                  : 'border-slate-700 bg-slate-900/40'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                  {plan.badge}
                </span>
              )}
              <h2 className="text-lg font-bold mb-1">{plan.name}</h2>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-slate-400 text-sm mb-1.5">{plan.period}</span>
              </div>
              {plan.note && <p className="text-emerald-400 text-sm mb-1">{plan.note}</p>}
              <p className="text-slate-400 text-sm mb-4">{plan.desc}</p>
              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check /><span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(plan.id)}
                disabled={loading !== ''}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                  plan.featured
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {loading === plan.id ? 'Redirecting...' : 'Get started'}
              </button>
            </div>
          ))}
        </div>

        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-amber-400 text-xs uppercase font-semibold tracking-wider mb-0.5">Optional Add-on</p>
            <p className="text-white text-sm font-medium">Daily Alerts - get notified the moment an overcharge is found</p>
            <p className="text-amber-400 text-sm font-semibold">+$199/month</p>
          </div>
          <button
            onClick={() => startCheckout('daily-addon')}
            disabled={loading !== ''}
            className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg disabled:opacity-60"
          >
            {loading === 'daily-addon' ? 'Redirecting...' : 'Add for $199/mo'}
          </button>
        </div>

        <div className="text-center text-slate-500 text-sm space-y-1">
          <p>All prices in CAD. Cancel monthly plans anytime.</p>
          <p>Two-month money-back guarantee.</p>
          <p>Questions? <a href="mailto:hello@shepherdsignals.com" className="text-emerald-400 hover:underline">hello@shepherdsignals.com</a></p>
        </div>

      </div>
    </main>
  )
}