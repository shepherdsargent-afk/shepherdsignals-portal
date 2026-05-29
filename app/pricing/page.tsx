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
    price: 649,
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
    price: 549,
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
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCheckout(planId: string) {
    setLoading(planId)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('Checkout error:', res.status, text)
        setError('Payment setup error. Please try again or contact support.')
        setLoading(null)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Could not start checkout. Please try again.')
        setLoading(null)
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Connection error. Please try again.')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white py-16 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="text-center mb-12">
          <Link href="https://shepherdsignals.com" className="text-sm text-slate-400 hover:text-white mb-8 inline-block">
            &larr; Back to shepherdsignals.com
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Simple, transparent pricing</h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-lg mx-auto">
            Procurement intelligence for golf clubs. Two months, or your money back.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 sm:p-8 flex flex-col ${
                plan.featured
                  ? 'border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-900/20'
                  : 'border-slate-700 bg-slate-900/40'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="mb-5">
                <h2 className="text-xl font-bold mb-2">{plan.name}</h2>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-slate-400 mb-1.5 text-sm">/ month</span>
                </div>
                {plan.note && <p className="text-emerald-400 text-sm font-medium">{plan.note}</p>}
                <p className="text-slate-400 text-sm mt-2">{plan.desc}</p>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check />
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                  plan.featured
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-60'
                    : 'bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-60'
                }`}
              >
                {loading === plan.id ? 'Redirecting to checkout...' : 'Get started'}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Optional Add-on</p>
              <p className="text-white font-medium text-sm">Daily Alerts &mdash; get notified the moment an overcharge is found</p>
              <p className="text-amber-400 text-sm font-semibold">+$199/month</p>
            </div>
            <button
              onClick={() => handleCheckout('daily-addon')}
              disabled={loading !== null}
              className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              {loading === 'daily-addon' ? 'Redirecting...' : 'Add for $199/mo'}
            </button>
          </div>
        </div>

        <div className="text-center text-slate-500 text-sm space-y-1.5">
          <p>All prices in CAD &middot; Secured by credit card &middot; Cancel monthly plans anytime</p>
          <p>Two-month money-back guarantee &mdash; no questions asked</p>
          <p>Questions? <a href="mailto:hello@shepherdsignals.com" className="text-emerald-400 hover:underline">hello@shepherdsignals.com</a></p>
        </div>

      </div>
    </main>
  )
}