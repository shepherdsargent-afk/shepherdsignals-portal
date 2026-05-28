'use client'
import { useState } from 'react'
import Link from 'next/link'

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 649,
    period: 'month',
    annualNote: null,
    description: 'Full procurement intelligence, billed monthly. Cancel anytime.',
    features: [
      'All vendor categories monitored',
      '24-hour price spike alerts',
      'Daily 6am procurement brief',
      'Verified cheaper alternatives',
      'Portal access & reporting dashboard',
      'Onboarding invoice audit',
    ],
    highlight: false,
    badge: null,
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 549,
    period: 'month',
    annualNote: '$6,588 billed annually',
    description: 'Everything in Monthly, plus dedicated support and quarterly reviews.',
    features: [
      'Everything in Monthly',
      'Priority override response',
      'Quarterly procurement review call',
      'Vendor negotiation support',
      'Accounting software integrations',
      'Early access to new features',
    ],
    highlight: true,
    badge: 'Most popular Â· Best value',
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Something went wrong. Please try again.')
        setLoading(null)
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white py-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <Link href="/" className="text-sm text-slate-400 hover:text-white mb-6 inline-block">
            â† Back to home
          </Link>
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Procurement intelligence built for golf clubs. Save in the first month or we&apos;ll refund you.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.highlight
                  ? 'border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-900/30'
                  : 'border-slate-700 bg-slate-900/50'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2">{plan.name}</h2>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-slate-400 mb-1">/ month</span>
                </div>
                {plan.annualNote && (
                  <p className="text-slate-400 text-sm">{plan.annualNote}</p>
                )}
                <p className="text-slate-400 text-sm mt-3">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 mt-0.5 shrink-0">âœ“</span>
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.highlight
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-60'
                    : 'bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-60'
                }`}
              >
                {loading === plan.id ? 'Redirectingâ€¦' : 'Get started'}
              </button>
            </div>
          ))}
        </div>

        {/* Trust footer */}
        <div className="text-center mt-14 text-slate-500 text-sm space-y-2">
          <p>All prices in CAD. Cancel monthly plans anytime.</p>
          <p>Questions? <a href="mailto:hello@shepherdsignals.com" className="text-emerald-400 hover:underline">hello@shepherdsignals.com</a></p>
        </div>
      </div>
    </main>
  )
}