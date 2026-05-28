import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const clubName = session.custom_fields?.find(f => f.key === 'club_name')?.text?.value || 'New Client'
    const contactEmail = session.custom_fields?.find(f => f.key === 'contact_email')?.text?.value || session.customer_details?.email
    const plan = session.metadata?.plan || 'both'

    if (!contactEmail) {
      console.error('No email found in session')
      return NextResponse.json({ received: true })
    }

    // Create or update the company in Supabase
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', clubName)
      .single()

    let companyId: string

    if (existing) {
      await supabase.from('companies').update({ plan, status: 'active' }).eq('id', existing.id)
      companyId = existing.id
    } else {
      const { data: newCompany } = await supabase
        .from('companies')
        .insert({
          name: clubName,
          plan,
          status: 'active',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .select('id')
        .single()
      companyId = newCompany?.id
    }

    // Add user to company
    if (companyId) {
      const { data: { users } } = await supabase.auth.admin.listUsers()
      let userId = users.find(u => u.email === contactEmail)?.id

      if (!userId) {
        const { data: newUser } = await supabase.auth.admin.createUser({
          email: contactEmail,
          email_confirm: true,
        })
        userId = newUser.user?.id
      }

      if (userId) {
        await supabase.from('company_users').upsert({
          company_id: companyId,
          user_id: userId,
          role: 'admin',
        })
      }
    }

    // Send magic link via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ShepherdSignals <signals@shepherdsignals.com>',
        to: contactEmail,
        subject: 'Welcome to ShepherdSignals â€” Your portal is ready',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0a1a;color:#fff;padding:40px;border-radius:12px;">
            <div style="color:#f59e0b;font-weight:700;font-size:18px;margin-bottom:24px;">SHEPHERDSIGNALS</div>
            <h1 style="font-size:24px;font-weight:700;margin-bottom:12px;">Welcome, ${clubName}</h1>
            <p style="color:#9ca3af;margin-bottom:24px;">Your ShepherdSignals account is active. You are now enrolled in the <strong style="color:#fff;">${plan === 'both' ? 'Full Monitoring' : plan === 'daily' ? 'Daily Alerts' : 'Weekly Digest'}</strong> plan.</p>
            <p style="color:#9ca3af;margin-bottom:32px;">Click below to access your procurement portal. No password required.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px;">
              Access My Portal
            </a>
            <p style="color:#4b5563;font-size:12px;margin-top:32px;">Questions? Reply to this email or contact shepherdsargent@shepherdsignals.com</p>
          </div>
        `,
      }),
    })

    console.log(`New client onboarded: ${clubName} (${contactEmail}) on ${plan} plan`)
  }

  return NextResponse.json({ received: true })
}