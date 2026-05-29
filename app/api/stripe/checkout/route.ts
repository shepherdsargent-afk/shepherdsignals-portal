import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

const PLAN_PRICES: Record<string, { name: string; amount: number; interval: 'month' | 'year' }> = {
  monthly:      { name: 'ShepherdSignals - Monthly',       amount: 64900,  interval: 'month' },
  annual:       { name: 'ShepherdSignals - Annual',        amount: 658800, interval: 'year'  },
  'daily-addon': { name: 'ShepherdSignals - Daily Alerts Add-on', amount: 19900, interval: 'month' },
}

export async function POST(req: NextRequest) {
  const { plan, email } = await req.json()
  const planConfig = PLAN_PRICES[plan]
  if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const origin = req.headers.get('origin') ?? 'https://portal.shepherdsignals.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email ?? undefined,
    line_items: [{
      price_data: {
        currency: 'cad',
        product_data: { name: planConfig.name },
        unit_amount: planConfig.amount,
        recurring: { interval: planConfig.interval },
      },
      quantity: 1,
    }],
    success_url: `${origin}/dashboard/settings?upgraded=true`,
    cancel_url:  `${origin}/dashboard/settings`,
    metadata: { plan },
  })

  return NextResponse.json({ url: session.url })
}