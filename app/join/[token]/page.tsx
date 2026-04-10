"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type InviteDetails = {
  family_name?: string
  familyName?: string
  inviter_name?: string
  inviterName?: string
}

export default function JoinPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/family/invite?token=${encodeURIComponent(token)}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (data) setInvite(data)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [token])

  // Auto-accept when already signed in (e.g. after OAuth redirect back to this page)
  useEffect(() => {
    if (session && invite && !joining) {
      acceptInvite()
    }
  }, [session, invite])

  // If not signed in, sign in with Google and redirect back to this join page after
  const signInToAccept = async () => {
    const { signIn } = await import('next-auth/react')
    await signIn('google', { callbackUrl: `/join/${token}` })
  }

  const acceptInvite = async () => {
    setJoining(true)
    setError('')
    try {
      const res = await fetch('/api/family/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to join family')
      router.push('/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setJoining(false)
    }
  }

  const familyName = invite?.family_name || invite?.familyName || 'your family'
  const inviterName = invite?.inviter_name || invite?.inviterName

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <span className="text-2xl font-extrabold text-[#f96400]">Fraydi</span>
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8 text-center">
        {loading ? (
          <div className="py-8">
            <div className="text-4xl mb-3 animate-pulse">🔗</div>
            <p className="text-gray-500 text-sm">Loading invite...</p>
          </div>
        ) : notFound ? (
          <div className="py-8">
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invite not found</h1>
            <p className="text-gray-500 text-sm mb-6">
              This invite link may have expired or is invalid. Ask your partner to send a new one.
            </p>
            <Link href="/" className="text-[#f96400] text-sm hover:underline">← Back to home</Link>
          </div>
        ) : (
          <div>
            <div className="text-5xl mb-4">🏠</div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
              You&apos;ve been invited!
            </h1>
            <p className="text-gray-600 text-base mb-1">
              {inviterName
                ? <><strong>{inviterName}</strong> invited you to join</>
                : 'You\'ve been invited to join'
              }
            </p>
            <p className="text-[#f96400] font-extrabold text-xl mb-6">{familyName}</p>
            <p className="text-gray-400 text-sm mb-8">
              on Fraydi — the AI coordination app for busy families.
            </p>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {status === 'loading' ? (
              <div className="text-gray-400 text-sm">Checking session...</div>
            ) : !session ? (
              <button
                onClick={signInToAccept}
                className="w-full bg-[#f96400] text-white py-3 rounded-xl font-bold hover:bg-[#d95400] transition"
              >
                Sign in with Google to accept →
              </button>
            ) : (
              <button
                onClick={acceptInvite}
                disabled={joining}
                className="w-full bg-[#f96400] text-white py-3 rounded-xl font-bold hover:bg-[#d95400] transition disabled:opacity-60"
              >
                {joining ? 'Joining...' : `Accept invitation →`}
              </button>
            )}

            <p className="mt-4 text-xs text-gray-400">
              Your partner&apos;s 30-day Pro trial starts on acceptance.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
