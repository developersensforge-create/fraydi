import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import Stripe from 'stripe'

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' }) }

const PRICE_IDS: Record<string, string> = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_placeholder_monthly',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_placeholder_annual',
}

// GET /api/subscription — returns current family subscription
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ subscription: null })
    }

    const { data: subscription } = await db
      .from('subscriptions')
      .select('*')
      .eq('family_id', profile.family_id)
      .single()

    return NextResponse.json({ subscription })
  } catch (err) {
    console.error('[GET /api/subscription]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/subscription — create Stripe checkout session
// Body: { plan: 'pro_monthly' | 'pro_annual' }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { plan } = body

    if (!plan || !PRICE_IDS[plan]) {
      return NextResponse.json({ error: 'Invalid plan. Use pro_monthly or pro_annual' }, { status: 400 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('*, families(*)')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'You must be in a family to subscribe' }, { status: 400 })
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined

    const { data: sub } = await db
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('family_id', profile.family_id)
      .single()

    stripeCustomerId = sub?.stripe_customer_id || undefined

    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: session.user.email,
        name: profile.full_name || session.user.name || undefined,
        metadata: { family_id: profile.family_id },
      })
      stripeCustomerId = customer.id

      // Save customer id
      await db
        .from('families')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', profile.family_id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fraydi.vercel.app'

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard?checkout=cancelled`,
      metadata: {
        family_id: profile.family_id,
        plan,
      },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.url })
  } catch (err) {
    console.error('[POST /api/subscription]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
