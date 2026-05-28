import Link from 'next/link'

const PLANS = [
  {
    id: 'weekly',
    name: 'Weekly Digest',
    price: 199,
    period: 'month',
    description: 'Perfect for clubs that want a regular procurement health check.',
    features: [
      'Weekly price spike summary',
      'Top 10 overcharges identified',
      'Market benchmark comparisons',
      'Vendor alternative suggestions',
      'Email digest every Monday',
    ],
    highlight: false,
    badge: null,
  },
  {
    id: 'both',
    name: 'Full Monitoring',
    price: 449,
    period: 'month',
    description: 'Complete procurement intelligence. Daily alerts + weekly digest.',
    features: [
      'Everything in Daily + Weekly',
      'Same-day price spike alerts',
      'Weekly procurement digest',
      'Accounting software integrations',
      'Invoice PDF processing',
      'Priority email support',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
  {
    id: 'daily',
    name: 'Daily Alerts',
    price: 299,
    period: 'month',
    description: 'Real-time alerts the moment a supplier overcharges you.',
    features: [
      'Price spike alerts within 24 hrs',
      'Invoice line-item monitoring',
      'Verified cheaper alternatives',
      'Vendor comparison reports',
      'Email + portal dashboard',
    ],
    highlight: false,
    badge: null,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            SHEPHERDSIGNALS
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Cancel anytime. No setup fees. Most clubs recover the cost in the first month.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-amber-500/5 border-amber-500/40'
                  : 'bg-white/[0.03] border-white/10'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="mb-5">
                <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">${plan.price}</span>
                <span className="text-gray-500 text-sm ml-1">/{plan.period}</span>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-amber-400 mt-0.5 shrink-0">+</span>
                    {f}
                  </li>
                ))}
              </ul>
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="plan" value={plan.id} />
                <button
                  type="submit"
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  Get Started
                </button>
              </form>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-gray-600 text-sm mb-2">
            Test mode active â€” use card <span className="font-mono text-gray-400">4242 4242 4242 4242</span>, any future date, any CVC
          </p>
          <p className="text-gray-700 text-xs">
            Questions? <a href="mailto:shepherdsargent@shepherdsignals.com" className="text-amber-400 hover:underline">shepherdsargent@shepherdsignals.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}