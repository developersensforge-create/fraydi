"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

type FamilyMember = {
  id: string
  family_id: string
  name: string
  role: 'me' | 'spouse' | 'kid' | 'other'
  color: string
  age?: number | null
  created_at: string
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
  members: Array<{
    id: string
    name: string
    email?: string
    role: string
    color: string
    isSelf?: boolean
  }>
  kids: Kid[]
  family_members: FamilyMember[]
}

const COLOR_PRESETS = ['#f96400', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

function roleEmoji(role: string) {
  switch (role) {
    case 'me': return '👤'
    case 'spouse': return '💑'
    case 'kid': return '👦'
    default: return '📅'
  }
}

function roleLabel(role: string) {
  switch (role) {
    case 'me': return 'me'
    case 'spouse': return 'spouse'
    case 'kid': return 'kid'
    default: return 'other'
  }
}

function ColorSwatch({
  color,
  onChange,
}: {
  color: string
  onChange: (c: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200 hover:ring-gray-400 transition-all flex-shrink-0"
        style={{ backgroundColor: color }}
        title="Change color"
      />
      {open && (
        <div className="absolute top-8 right-0 z-30 bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
          <div className="flex gap-2 flex-wrap w-44">
            {COLOR_PRESETS.map(c => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false) }}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MemberRow({
  member,
  onRename,
  onColorChange,
  onDelete,
}: {
  member: FamilyMember
  onRename: (id: string, name: string) => Promise<void>
  onColorChange: (id: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(member.name)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!nameVal.trim() || nameVal.trim() === member.name) {
      setEditing(false)
      setNameVal(member.name)
      return
    }
    setSaving(true)
    await onRename(member.id, nameVal.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Role emoji */}
      <span className="text-xl flex-shrink-0">{roleEmoji(member.role)}</span>

      {/* Name — inline editable */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { setEditing(false); setNameVal(member.name) }
            }}
            className="text-sm font-semibold text-gray-900 border-b-2 border-[#f96400] focus:outline-none bg-transparent pb-0.5 w-full"
            disabled={saving}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-gray-900 hover:text-[#f96400] transition-colors text-left truncate w-full"
            title="Click to edit name"
          >
            {member.name}
          </button>
        )}
      </div>

      {/* Role badge + age for kids */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {roleLabel(member.role)}
        </span>
        {member.role === 'kid' && member.age != null && (
          <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
            age {member.age}
          </span>
        )}
      </div>

      {/* Color swatch */}
      <ColorSwatch
        color={member.color}
        onChange={(c) => onColorChange(member.id, c)}
      />

      {/* Delete (not for 'me') */}
      {member.role !== 'me' && (
        <button
          onClick={() => onDelete(member.id)}
          className="text-gray-300 hover:text-red-400 transition-colors text-sm flex-shrink-0"
          title="Remove"
        >
          ✕
        </button>
      )}
    </div>
  )
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
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  // Add member state
  const [addingRole, setAddingRole] = useState<'spouse' | 'kid' | 'other' | null>(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberAge, setNewMemberAge] = useState('')
  const [savingMember, setSavingMember] = useState(false)

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
      setTimeout(() => { setInviteSent(false) }, 2500)
    } catch (e: unknown) {
      showNotif(e instanceof Error ? e.message : 'Failed to send invite')
    } finally {
      setSendingInvite(false)
    }
  }

  // Family members CRUD
  const addMember = async () => {
    if (!newMemberName.trim() || !addingRole) return
    setSavingMember(true)
    try {
      const res = await fetch('/api/family/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName.trim(), role: addingRole, color: '#6366f1', age: newMemberAge ? parseInt(newMemberAge) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add member')
      setFamily(prev => prev ? {
        ...prev,
        family_members: [...(prev.family_members || []), data.member],
      } : prev)
      setNewMemberName('')
      setNewMemberAge('')
      setAddingRole(null)
      showNotif(`${newMemberName} added!`)
    } catch (e: unknown) {
      showNotif(e instanceof Error ? e.message : 'Failed to add member')
    } finally {
      setSavingMember(false)
    }
  }

  const renameMember = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/family/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      setFamily(prev => prev ? {
        ...prev,
        family_members: prev.family_members.map(m => m.id === id ? { ...m, name } : m),
      } : prev)
    } catch {
      showNotif('Failed to save name')
    }
  }

  const changeColor = async (id: string, color: string) => {
    // Optimistic update
    setFamily(prev => prev ? {
      ...prev,
      family_members: prev.family_members.map(m => m.id === id ? { ...m, color } : m),
    } : prev)
    try {
      await fetch(`/api/family/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
    } catch {
      showNotif('Failed to save color')
    }
  }

  const deleteMember = async (id: string) => {
    const member = family?.family_members.find(m => m.id === id)
    if (!member) return
    if (!confirm(`Remove ${member.name}?`)) return
    try {
      const res = await fetch(`/api/family/members/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setFamily(prev => prev ? {
        ...prev,
        family_members: prev.family_members.filter(m => m.id !== id),
      } : prev)
      showNotif(`${member.name} removed`)
    } catch {
      showNotif('Failed to remove member')
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
          <p className="text-gray-500 text-sm mt-1">Manage your family members and invite links.</p>
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

              {/* Invite partner */}
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

            {/* ── Who's in your family ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-900 mb-4">Who&apos;s in your family</h2>

              {/* Member list */}
              <div className="flex flex-col gap-2 mb-4">
                {(family.family_members || []).map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onRename={renameMember}
                    onColorChange={changeColor}
                    onDelete={deleteMember}
                  />
                ))}

                {(family.family_members || []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Loading family members…
                  </p>
                )}
              </div>

              {/* Add member form */}
              {addingRole ? (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {roleEmoji(addingRole)} Add {addingRole}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Name"
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addMember()
                        if (e.key === 'Escape') { setAddingRole(null); setNewMemberName(''); setNewMemberAge('') }
                      }}
                      className="flex-1 min-w-[120px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white"
                    />
                    {addingRole === 'kid' && (
                      <input
                        type="number"
                        placeholder="Age"
                        min={0} max={18}
                        value={newMemberAge}
                        onChange={e => setNewMemberAge(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addMember() }}
                        className="w-20 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white"
                      />
                    )}
                    <button
                      onClick={addMember}
                      disabled={savingMember || !newMemberName.trim()}
                      className="bg-[#f96400] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#d95400] transition disabled:opacity-50"
                    >
                      {savingMember ? '...' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAddingRole(null); setNewMemberName(''); setNewMemberAge('') }}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setAddingRole('spouse'); setNewMemberName('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-[#f96400] hover:text-[#f96400] transition-colors bg-white"
                  >
                    <span>💑</span> + Add spouse
                  </button>
                  <button
                    onClick={() => { setAddingRole('kid'); setNewMemberName('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-[#f96400] hover:text-[#f96400] transition-colors bg-white"
                  >
                    <span>👦</span> + Add kid
                  </button>
                  <button
                    onClick={() => { setAddingRole('other'); setNewMemberName('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-[#f96400] hover:text-[#f96400] transition-colors bg-white"
                  >
                    <span>📅</span> + Add other
                  </button>
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
