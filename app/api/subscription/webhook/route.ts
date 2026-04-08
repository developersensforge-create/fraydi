import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
})

// Stripe requires the raw body for webhook signature verification
export const config = { api: { bodyParser: false } }

// POST /api/subscription/webhook — Stripe webhook handler
export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    const body = await request.text()

    if (webhookSecret && sig && webhookSecret !== 'whsec_test_placeholder') {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      // No secret configured — parse directly (dev/test mode)
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const db = createServerSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        const familyId = checkoutSession.metadata?.family_id
        const plan = checkoutSession.metadata?.plan || 'pro_monthly'

        if (!familyId) break

        const stripeSubId =
          typeof checkoutSession.subscription === 'string'
            ? checkoutSession.subscription
            : checkoutSession.subscription?.id

        let currentPeriodEnd: string | undefined
        if (stripeSubId) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)
            currentPeriodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString()
          } catch {
            // Non-fatal
          }
        }

        // Upsert subscription record
        await db.from('subscriptions').upsert(
          {
            family_id: familyId,
            stripe_customer_id: checkoutSession.customer as string,
            stripe_subscription_id: stripeSubId || null,
            plan,
            status: 'active',
            current_period_end: currentPeriodEnd || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'family_id' }
        )

        // Also update stripe_customer_id on the family record
        await db
          .from('families')
          .update({ stripe_customer_id: checkoutSession.customer as string })
          .eq('id', familyId)

        break
      }

      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription
        const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id

        const { data: family } = await db
          .from('families')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!family) break

        const plan = (stripeSub.metadata?.plan as string) || 'pro_monthly'
        const statusMap: Record<string, string> = {
          active: 'active',
          trialing: 'trialing',
          canceled: 'canceled',
          past_due: 'past_due',
          unpaid: 'past_due',
          incomplete: 'past_due',
          incomplete_expired: 'canceled',
          paused: 'canceled',
        }

        await db.from('subscriptions').upsert(
          {
            family_id: family.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: stripeSub.id,
            plan,
            status: statusMap[stripeSub.status] || stripeSub.status,
            current_period_end: new Date((stripeSub as any).current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'family_id' }
        )

        break
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription
        const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id

        const { data: family } = await db
          .from('families')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!family) break

        await db
          .from('subscriptions')
          .update({
            status: 'canceled',
            plan: 'free',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('family_id', family.id)

        break
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
