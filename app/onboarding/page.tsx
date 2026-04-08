"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Kid = { name: string; age: string }

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [familyName, setFamilyName] = useState('')
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [partnerEmail, setPartnerEmail] = useState('')
  const [kids, setKids] = useState<Kid[]>([{ name: '', age: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Step 1: Create family
  const createFamily = async () => {
    if (!familyName.trim()) { setError('Please enter a family name'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: familyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create family')
      setFamilyId(data.id || data.family_id)
      const token = data.invite_token || data.inviteToken || data.token || ''
      setInviteToken(token)
      const origin = window.location.origin
      setInviteLink(token ? `${origin}/join/${token}` : `${origin}/join`)
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Send invite
  const sendInvite = async () => {
    if (!partnerEmail.trim()) { setError('Please enter your partner\'s email'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: partnerEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invite')
      setInviteSent(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  // Step 3: Add kids
  const addKid = () => setKids([...kids, { name: '', age: '' }])
  const updateKid = (i: number, field: keyof Kid, val: string) => {
    setKids(kids.map((k, idx) => idx === i ? { ...k, [field]: val } : k))
  }
  const removeKid = (i: number) => setKids(kids.filter((_, idx) => idx !== i))

  const finishOnboarding = async () => {
    setLoading(true)
    setError('')
    const validKids = kids.filter(k => k.name.trim())
    try {
      if (validKids.length > 0) {
        const res = await fetch('/api/family/kids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kids: validKids.map(k => ({ name: k.name.trim(), age: k.age || undefined })) }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to add kids')
        }
      }
      // Mark onboarding complete
      await fetch('/api/family/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true }),
      })
      router.push('/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const skipToFinish = async () => {
    try {
      await fetch('/api/family/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true }),
      })
    } catch {}
    router.push('/dashboard')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <span className="text-2xl font-extrabold text-[#f96400]">Fraydi</span>
      </Link>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              s < step ? 'bg-[#f96400] text-white' :
              s === step ? 'bg-[#f96400] text-white ring-4 ring-orange-100' :
              'bg-gray-200 text-gray-400'
            }`}>
              {s < step ? '✓' : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-[#f96400]' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-8">Step {step} of 3</p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* ── Step 1: Name your family ── */}
        {step === 1 && (
          <div>
            <div className="text-4xl mb-4">🏠</div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Name your family</h1>
            <p className="text-gray-500 text-sm mb-6">This is how your family will be identified in Fraydi.</p>
            <input
              type="text"
              placeholder="e.g. The Smiths"
              value={familyName}
              onChange={e => { setFamilyName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && createFamily()}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] focus:border-transparent mb-4"
            />
            <button
              onClick={createFamily}
              disabled={loading}
              className="w-full bg-[#f96400] text-white py-3 rounded-xl font-bold hover:bg-[#d95400] transition disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create family →'}
            </button>
            <div className="mt-4 text-center">
              <Link href="/join" className="text-sm text-[#f96400] hover:underline">
                Already have an invite code? Join instead →
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 2: Invite partner ── */}
        {step === 2 && (
          <div>
            <div className="text-4xl mb-4">🤝</div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Invite your partner</h1>
            <p className="text-gray-500 text-sm mb-1">
              Fraydi works best with both partners connected.{' '}
              <span className="text-[#f96400] font-medium">Your partner gets a 30-day free trial too.</span>
            </p>
            <p className="text-gray-400 text-xs mb-6">Family: <strong className="text-gray-700">{familyName}</strong></p>

            {/* Invite link */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400 flex-shrink-0">Invite link:</span>
              <span className="text-xs text-gray-700 flex-1 truncate font-mono">{inviteLink}</span>
              <button onClick={copyInviteLink} className="text-lg flex-shrink-0 hover:scale-110 transition-transform" title="Copy">
                {inviteCopied ? '✅' : '📋'}
              </button>
            </div>

            {/* Send by email */}
            {!inviteSent ? (
              <>
                <div className="flex gap-2 mb-4">
                  <input
                    type="email"
                    placeholder="Partner's email address"
                    value={partnerEmail}
                    onChange={e => { setPartnerEmail(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && sendInvite()}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] focus:border-transparent"
                  />
                  <button
                    onClick={sendInvite}
                    disabled={loading}
                    className="bg-[#f96400] text-white px-4 py-3 rounded-xl font-semibold hover:bg-[#d95400] transition text-sm disabled:opacity-60"
                  >
                    {loading ? '...' : 'Send'}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-xl mb-4">
                ✅ Invite sent to {partnerEmail}!
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              className="w-full bg-[#f96400] text-white py-3 rounded-xl font-bold hover:bg-[#d95400] transition mb-3"
            >
              Next →
            </button>
            <button
              onClick={() => setStep(3)}
              className="w-full text-gray-400 text-sm hover:text-gray-600 transition py-1"
            >
              I&apos;ll do this later →
            </button>
          </div>
        )}

        {/* ── Step 3: Add kids ── */}
        {step === 3 && (
          <div>
            <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Add your kids</h1>
            <p className="text-gray-500 text-sm mb-6">Help Fraydi understand your family. You can always add more later.</p>

            <div className="space-y-3 mb-4">
              {kids.map((kid, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Child's name"
                    value={kid.name}
                    onChange={e => updateKid(i, 'name', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Age (optional)"
                    value={kid.age}
                    onChange={e => updateKid(i, 'age', e.target.value)}
                    className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] focus:border-transparent"
                  />
                  {kids.length > 1 && (
                    <button onClick={() => removeKid(i)} className="text-gray-400 hover:text-red-500 transition px-1 text-lg">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addKid}
              className="flex items-center gap-1 text-sm text-[#f96400] hover:underline mb-6"
            >
              + Add another child
            </button>

            <button
              onClick={finishOnboarding}
              disabled={loading}
              className="w-full bg-[#f96400] text-white py-3 rounded-xl font-bold hover:bg-[#d95400] transition mb-3 disabled:opacity-60"
            >
              {loading ? 'Saving...' : "Let's go →"}
            </button>
            <button
              onClick={skipToFinish}
              className="w-full text-gray-400 text-sm hover:text-gray-600 transition py-1"
            >
              No kids yet, skip →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
