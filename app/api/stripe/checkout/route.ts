import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

const PLANS: Record<string, { name: string; amount: number; interval: 'month' | 'year' }> = {
  monthly:       { name: 'ShepherdSignals - Monthly',             amount: 64900,  interval: 'month' },
  annual:        { name: 'ShepherdSignals - Annual',              amount: 658800, interval: 'year'  },
  'daily-addon': { name: 'ShepherdSignals - Daily Alerts Add-on', amount: 19900,  interval: 'month' },
}

export async function POST(req: NextRequest) {
  try {
    const { plan, email } = await req.json()
    const planConfig = PLANS[plan]
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan: ' + plan }, { status: 400 })
    }
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
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/pricing`,
      metadata: { plan },
    })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message ?? 'Checkout failed' }, { status: 500 })
  }
}