"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

type Member = {
  id: string
  name: string
  email?: string
  role: string
  color: string
  isSelf?: boolean
}

type Kid = {
  id: string
  name: string
  age?: string | number
}

type FamilyData = {
  id: string
  name: string
  invite_token?: string
  inviteToken?: string
  members: Member[]
  kids: Kid[]
}

export default function FamilyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [family, setFamily] = useState<FamilyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [familyName, setFamilyName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [inviteCopied, setInviteCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [showInviteInput, setShowInviteInput] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  const [addingChild, setAddingChild] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [newChildAge, setNewChildAge] = useState('')
  const [savingChild, setSavingChild] = useState(false)

  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const showNotif = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 2500)
  }

  const loadFamily = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/family')
      if (res.status === 404) {
        // No family yet — redirect to onboarding
        router.push('/onboarding')
        return
      }
      if (!res.ok) throw new Error('Failed to load family data')
      const data: FamilyData = await res.json()
      setFamily(data)
      setFamilyName(data.name)
      setNameInput(data.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load family')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (status === 'authenticated') loadFamily()
  }, [status, loadFamily])

  const saveFamilyName = async () => {
    if (!nameInput.trim() || nameInput.trim() === familyName) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      const res = await fetch('/api/family', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setFamilyName(nameInput.trim())
      setEditingName(false)
      showNotif('Family name updated!')
    } catch {
      showNotif('Failed to save family name')
    } finally {
      setSavingName(false)
    }
  }

  const copyInviteLink = () => {
    const token = family?.invite_token || family?.inviteToken
    if (!token) return
    const link = `${window.location.origin}/join/${token}`
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true)
      showNotif('Invite link copied!')
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setSendingInvite(true)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setInviteSent(true)
      setInviteEmail('')
      showNotif('Invite sent!')
      setTimeout(() => { setInviteSent(false); setShowInviteInput(false) }, 2500)
    } catch (e: unknown) {
      showNotif(e instanceof Error ? e.message : 'Failed to send invite')
    } finally {
      setSendingInvite(false)
    }
  }

  const addChild = async () => {
    if (!newChildName.trim()) return
    setSavingChild(true)
    try {
      const res = await fetch('/api/family/kids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChildName.trim(), age: newChildAge || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add child')
      const newKid: Kid = data.kid || data
      setFamily(prev => prev ? { ...prev, kids: [...(prev.kids || []), newKid] } : prev)
      setNewChildName('')
      setNewChildAge('')
      setAddingChild(false)
      showNotif(`${newChildName} added!`)
    } catch (e: unknown) {
      showNotif(e instanceof Error ? e.message : 'Failed to add child')
    } finally {
      setSavingChild(false)
    }
  }

  const inviteToken = family?.invite_token || family?.inviteToken

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded-xl w-48" />
            <div className="h-32 bg-gray-200 rounded-2xl" />
            <div className="h-32 bg-gray-200 rounded-2xl" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {notification}
        </div>
      )}

      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Family</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your family members, kids, and invite links.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error} <button onClick={loadFamily} className="underline ml-2">Retry</button>
          </div>
        )}

        {family && (
          <>
            {/* ── Family Header ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Family Name</label>
              {editingName ? (
                <div className="flex gap-2 mt-1">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveFamilyName()
                      if (e.key === 'Escape') { setEditingName(false); setNameInput(familyName) }
                    }}
                    className="flex-1 text-xl font-bold text-gray-900 border-b-2 border-[#f96400] focus:outline-none bg-transparent pb-0.5"
                  />
                  <button
                    onClick={saveFamilyName}
                    disabled={savingName}
                    className="text-sm text-[#f96400] font-semibold hover:underline disabled:opacity-60"
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNameInput(familyName) }}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingName(true); setNameInput(familyName) }}
                  className="mt-1 block text-xl font-bold text-gray-900 hover:text-[#f96400] transition-colors text-left w-full"
                  title="Click to edit"
                >
                  {familyName} ✏️
                </button>
              )}

              {/* Invite partner — always visible */}
              <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                <p className="text-sm font-semibold text-gray-800 mb-3">📨 Invite your partner</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    placeholder="Partner's email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendInvite()}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white"
                  />
                  <button
                    onClick={sendInvite}
                    disabled={sendingInvite || !inviteEmail.trim()}
                    className="bg-[#f96400] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d95400] transition disabled:opacity-50"
                  >
                    {sendingInvite ? '...' : inviteSent ? '✅ Sent!' : 'Send invite'}
                  </button>
                </div>
                {inviteToken && (
                  <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
                    <span className="text-xs text-gray-400 flex-shrink-0">Or share link:</span>
                    <span className="text-xs font-mono text-gray-600 truncate flex-1">
                      {typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteToken}` : `/join/${inviteToken}`}
                    </span>
                    <button onClick={copyInviteLink} className="text-base hover:scale-110 transition-transform flex-shrink-0" title="Copy link">
                      {inviteCopied ? '✅' : '📋'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Members ── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Family Members ({family.members?.length || 0})
              </h2>
              {family.members?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                  No members yet. Invite your partner above!
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {family.members?.map(member => (
                    <div key={member.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: member.color || '#f96400' }}
                      >
                        {member.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {member.name}
                          {member.isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{member.role}</p>
                      </div>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: member.color }} title={`Calendar color`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Kids ── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Kids ({family.kids?.length || 0})
              </h2>
              {family.kids?.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {family.kids.map(kid => (
                    <div key={kid.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                      <span className="text-xl">👶</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{kid.name}</p>
                        {kid.age && <p className="text-xs text-gray-400">Age {kid.age}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add child form */}
              {!addingChild ? (
                <button
                  onClick={() => setAddingChild(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:border-[#f96400] hover:text-[#f96400] transition-colors bg-white"
                >
                  + Add child
                </button>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add a child</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Child's name"
                      value={newChildName}
                      onChange={e => setNewChildName(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400]"
                    />
                    <input
                      type="text"
                      placeholder="Age"
                      value={newChildAge}
                      onChange={e => setNewChildAge(e.target.value)}
                      className="w-20 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addChild}
                      disabled={savingChild}
                      className="flex-1 bg-[#f96400] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#d95400] transition disabled:opacity-60"
                    >
                      {savingChild ? 'Adding...' : 'Add child'}
                    </button>
                    <button
                      onClick={() => { setAddingChild(false); setNewChildName(''); setNewChildAge('') }}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!family && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏠</div>
            <p className="text-gray-700 font-semibold mb-2">No family yet</p>
            <p className="text-gray-500 text-sm mb-4">Set up your family to get started.</p>
            <Link href="/onboarding" className="bg-[#f96400] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d95400] transition">
              Set up family
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
