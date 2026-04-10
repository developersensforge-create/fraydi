'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

type FamilyMember = {
  id: string
  name: string
  email?: string | null
  role: string
  invite_status: string
  color?: string
  member_child_links?: Array<{ child_id: string }>
}

const ADULT_ROLES = ['spouse', 'co-parent', 'grandparent', 'caregiver', 'other']
const ROLE_LABELS: Record<string, string> = {
  spouse: 'Spouse',
  'co-parent': 'Co-parent',
  grandparent: 'Grandparent',
  caregiver: 'Caregiver',
  other: 'Other',
  kid: 'Kid',
  me: 'Me',
}
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Invite pending', color: 'text-yellow-600 bg-yellow-50' },
  accepted:    { label: 'Active',         color: 'text-green-700 bg-green-50' },
  not_invited: { label: 'No invite',      color: 'text-gray-400 bg-gray-100' },
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Edit Member Modal ────────────────────────────────────────────────────────
function EditMemberModal({
  member,
  kids,
  onClose,
  onSaved,
}: {
  member: FamilyMember
  kids: FamilyMember[]
  onClose: () => void
  onSaved: () => void
}) {
  const isKid = member.role === 'kid' || member.role === 'me'
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email ?? '')
  const [role, setRole] = useState(member.role)
  const [saving, setSaving] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const body: Record<string, string> = {}
      if (name.trim() !== member.name) body.name = name.trim()
      if (!isKid && role !== member.role) body.role = role
      if (!isKid && email.trim() !== (member.email ?? '')) body.email = email.trim()

      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/family/members/${member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const resendInvite = async () => {
    setResending(true); setError(null); setSuccess(null)
    try {
      // Save email first if it changed
      if (email.trim() && email.trim() !== (member.email ?? '')) {
        const saveRes = await fetch(`/api/family/members/${member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        if (!saveRes.ok) { const d = await saveRes.json(); throw new Error(d.error) }
        onSaved()
      }
      const res = await fetch(`/api/family/members/${member.id}/resend-invite`, { method: 'POST' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSuccess('Invite sent to ' + email + ' ✓')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resend invite')
    } finally { setResending(false) }
  }

  const remove = async () => {
    if (!confirm(`Remove ${member.name} from your family?`)) return
    setSaving(true)
    try {
      await fetch(`/api/family/members/${member.id}`, { method: 'DELETE' })
      onSaved(); onClose()
    } catch { setError('Failed to remove') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Edit {member.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Role (adults only) */}
          {!isKid && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={role} onChange={e => setRole(e.target.value)}>
                {ADULT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          )}

          {/* Email + send invite (adults only) */}
          {!isKid && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Invite Email</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                type="email" placeholder="email@example.com"
                value={email} onChange={e => setEmail(e.target.value)} />
              {email && member.invite_status !== 'accepted' && (
                <button onClick={resendInvite} disabled={resending}
                  className="mt-2 w-full text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl disabled:opacity-50 transition">
                  {resending ? '⏳ Sending…' : '📨 ' + (member.email ? 'Resend Invite' : 'Save Email & Send Invite')}
                </button>
              )}
            </div>
          )}

          {success && <p className="text-xs text-green-600">{success}</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex items-center justify-between">
          {member.role !== 'me' ? (
            <button onClick={remove} className="text-xs text-red-500 hover:underline">Remove</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving}
              className="text-sm px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({
  kids,
  onClose,
  onAdded,
}: {
  kids: FamilyMember[]
  onClose: () => void
  onAdded: () => void
}) {
  const [tab, setTab] = useState<'adult' | 'kid'>('adult')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('spouse')
  const [selectedKids, setSelectedKids] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleKid = (id: string) =>
    setSelectedKids(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        role: tab === 'kid' ? 'kid' : role,
      }
      if (tab === 'adult' && email.trim()) body.email = email.trim()
      if (tab === 'adult' && selectedKids.length > 0) body.child_ids = selectedKids

      const res = await fetch('/api/family/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      onAdded(); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Family Member</h3>
          {/* Tab */}
          <div className="flex gap-2 mt-3">
            {(['adult', 'kid'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {t === 'adult' ? '👤 Adult' : '🧒 Kid'}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder={tab === 'kid' ? "e.g. Hayden" : "e.g. Jane"}
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {tab === 'adult' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={role} onChange={e => setRole(e.target.value)}>
                  {ADULT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email (to send invite)</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  type="email" placeholder="email@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              {kids.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Which kids are they helping with?</label>
                  <div className="space-y-1">
                    {kids.map(k => (
                      <label key={k.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={selectedKids.includes(k.id)}
                          onChange={() => toggleKid(k.id)}
                          className="rounded accent-orange-500" />
                        <span className="text-sm text-gray-700">{k.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
            {saving ? 'Adding…' : tab === 'kid' ? 'Add Kid' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/family/members')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setMembers(data.members ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchMembers() }, [])

  const adults = members.filter(m => m.role !== 'kid')
  const kids = members.filter(m => m.role === 'kid')

  const MemberRow = ({ m }: { m: FamilyMember }) => {
    const status = STATUS_META[m.invite_status] ?? STATUS_META.not_invited
    const isMe = m.role === 'me'
    return (
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
          {initials(m.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{m.name} {isMe && <span className="text-xs text-gray-400">(you)</span>}</p>
          <p className="text-xs text-gray-400">{ROLE_LABELS[m.role] ?? m.role}</p>
          {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
        </div>
        {!isMe && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${status.color}`}>
            {status.label}
          </span>
        )}
        {!isMe && (
          <button onClick={() => setEditing(m)}
            className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors flex-shrink-0">
            Edit
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👨‍👩‍👧‍👦 Family</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage family members and calendar sharing.</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + Add Member
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-12">{error}</div>
        ) : (
          <div className="space-y-6">
            {/* Adults section */}
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Adults ({adults.length})</h2>
              {adults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No adults yet.</p>
              ) : (
                <div className="space-y-2">{adults.map(m => <MemberRow key={m.id} m={m} />)}</div>
              )}
            </div>

            {/* Kids section */}
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Kids ({kids.length})</h2>
              {kids.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No kids added yet.</p>
              ) : (
                <div className="space-y-2">{kids.map(m => <MemberRow key={m.id} m={m} />)}</div>
              )}
            </div>
          </div>
        )}
      </main>

      {showAdd && (
        <AddMemberModal
          kids={kids}
          onClose={() => setShowAdd(false)}
          onAdded={() => { fetchMembers() }}
        />
      )}

      {editing && (
        <EditMemberModal
          member={editing}
          kids={kids}
          onClose={() => setEditing(null)}
          onSaved={() => { fetchMembers() }}
        />
      )}
    </div>
  )
}
