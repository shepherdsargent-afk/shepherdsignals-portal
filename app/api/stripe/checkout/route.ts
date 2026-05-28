import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const PLAN_PRICES: Record<string, { name: string; amount: number; description: string }> = {
  weekly: {
    name: 'ShepherdSignals â€” Weekly Digest',
    amount: 19900,
    description: 'Weekly procurement price spike summary and market benchmarks',
  },
  daily: {
    name: 'ShepherdSignals â€” Daily Alerts',
    amount: 29900,
    description: 'Real-time price spike alerts within 24 hours of invoice processing',
  },
  both: {
    name: 'ShepherdSignals â€” Full Monitoring',
    amount: 44900,
    description: 'Complete procurement intelligence: daily alerts + weekly digest',
  },
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const plan = formData.get('plan') as string

    const planConfig = PLAN_PRICES[plan]
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.shepherdsignals.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
              images: ['https://shepherdsignals.com/images/logo.png'],
            },
            unit_amount: planConfig.amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      custom_fields: [
        {
          key: 'club_name',
          label: { type: 'custom', custom: 'Golf Club / Business Name' },
          type: 'text',
        },
        {
          key: 'contact_email',
          label: { type: 'custom', custom: 'Contact Email for Portal Access' },
          type: 'text',
        },
      ],
      metadata: { plan },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    })

    return NextResponse.redirect(session.url!, 303)
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}