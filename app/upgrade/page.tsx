"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

type SubscriptionData = {
  plan: 'free' | 'trial' | 'pro'
  trial_ends_at?: string
  trialEndsAt?: string
  billing_portal_url?: string
  billingPortalUrl?: string
}

export default function UpgradePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [upgrading, setUpgrading] = useState<'monthly' | 'annual' | null>(null)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSubscription(data) })
      .catch(() => {})
      .finally(() => setLoadingSub(false))
  }, [status])

  const handleUpgrade = async (interval: 'monthly' | 'annual') => {
    setUpgrading(interval)
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to start checkout')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUpgrading(null)
    }
  }

  const isPro = subscription?.plan === 'pro'
  const isTrial = subscription?.plan === 'trial'
  const billingPortalUrl = subscription?.billing_portal_url || subscription?.billingPortalUrl
  const trialEndsAt = subscription?.trial_ends_at || subscription?.trialEndsAt

  const getPlanLabel = () => {
    if (!subscription) return null
    if (subscription.plan === 'pro') return { label: 'Pro Family', color: 'text-green-600', bg: 'bg-green-50 border-green-100' }
    if (subscription.plan === 'trial') return { label: 'Pro Trial', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' }
    return { label: 'Free', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' }
  }

  const planInfo = getPlanLabel()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            {isPro ? '✅ You\'re on Pro' : 'Upgrade to Pro Family'}
          </h1>
          <p className="text-gray-500">
            {isPro
              ? 'You have full access to all Fraydi features.'
              : 'Unlock AI conflict detection, partner nudges, and task management.'}
          </p>
        </div>

        {/* Current plan badge */}
        {!loadingSub && planInfo && (
          <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold mb-8 w-fit mx-auto ${planInfo.bg} ${planInfo.color}`}>
            Current plan: {planInfo.label}
            {isTrial && trialEndsAt && (
              <span className="text-xs font-normal text-gray-500 ml-1">
                · Trial ends {new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {isPro ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re all set!</h2>
            <p className="text-gray-500 text-sm mb-6">
              You have full access to all Pro features including AI conflict detection, partner nudges, and shared task management.
            </p>
            {billingPortalUrl && (
              <a
                href={billingPortalUrl}
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                Manage billing ↗
              </a>
            )}
            <div className="mt-4">
              <Link href="/dashboard" className="text-sm text-[#f96400] hover:underline">← Back to dashboard</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <button
                onClick={() => setBillingInterval('monthly')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${billingInterval === 'monthly' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('annual')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billingInterval === 'annual' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              >
                Annual
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${billingInterval === 'annual' ? 'bg-[#f96400] text-white' : 'bg-green-100 text-green-700'}`}>
                  Save 28%
                </span>
              </button>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {/* Free */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Free</h3>
                <p className="text-gray-400 text-sm mb-4">Basic calendar access</p>
                <div className="text-3xl font-extrabold text-gray-900 mb-1">$0</div>
                <p className="text-gray-400 text-xs mb-6">forever</p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
                  <li>✅ 1 user</li>
                  <li>✅ Basic calendar view</li>
                  <li>✅ 30-day Pro trial</li>
                  <li className="text-gray-300">✗ AI conflict detection</li>
                  <li className="text-gray-300">✗ Partner nudges</li>
                  <li className="text-gray-300">✗ Task management</li>
                </ul>
                <div className="text-center text-sm text-gray-400 py-2.5">Current plan</div>
              </div>

              {/* Pro */}
              <div className="bg-[#f96400] rounded-2xl p-6 flex flex-col text-white relative">
                <div className="absolute top-3 right-3 bg-white text-[#f96400] text-xs font-bold px-2 py-0.5 rounded-full">
                  BEST VALUE
                </div>
                <h3 className="text-lg font-bold mb-1">Pro Family</h3>
                <p className="text-orange-100 text-sm mb-4">Everything, for the whole family</p>
                {billingInterval === 'annual' ? (
                  <>
                    <div className="text-3xl font-extrabold mb-1">$59.99</div>
                    <p className="text-orange-200 text-xs mb-6">per year · ~$5/month</p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-extrabold mb-1">$6.99</div>
                    <p className="text-orange-200 text-xs mb-6">per month</p>
                  </>
                )}
                <ul className="space-y-2 text-sm text-orange-50 mb-6 flex-1">
                  <li>✅ Both partners</li>
                  <li>✅ All calendar features</li>
                  <li>✅ AI conflict detection</li>
                  <li>✅ Partner nudges</li>
                  <li>✅ Task management</li>
                  <li>✅ 30-day free trial</li>
                </ul>
                <button
                  onClick={() => handleUpgrade(billingInterval)}
                  disabled={!!upgrading}
                  className="w-full bg-white text-[#f96400] py-3 rounded-xl font-bold hover:bg-orange-50 transition disabled:opacity-60"
                >
                  {upgrading === billingInterval
                    ? 'Redirecting...'
                    : isTrial
                    ? 'Upgrade to Pro'
                    : 'Start free trial'}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400">
              Secure checkout via Stripe. Cancel anytime. 30-day money-back guarantee.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
