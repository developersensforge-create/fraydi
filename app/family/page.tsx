'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'

type Child = { child_id: string }

type FamilyMember = {
  id: string
  name: string
  email?: string
  role: string
  invite_status: string
  member_child_links?: Child[]
}

type AddMemberForm = {
  name: string
  email: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  spouse: 'Spouse',
  'co-parent': 'Co-parent',
  grandparent: 'Grandparent',
  caregiver: 'Caregiver',
  other: 'Other',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Invite pending', color: 'text-yellow-600 bg-yellow-50' },
  accepted:    { label: 'Active',          color: 'text-green-700 bg-green-50' },
  not_invited: { label: 'No invite sent',  color: 'text-gray-500 bg-gray-100' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<AddMemberForm>({ name: '', email: '', role: 'spouse' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/family/members')
      if (!res.ok) throw new Error('Failed to load family members')
      const data = await res.json()
      setMembers(data.members ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [])

  const handleAdd = async () => {
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/family/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim() || undefined, role: form.role }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to add member')
      }
      setForm({ name: '', email: '', role: 'spouse' })
      setShowModal(false)
      await fetchMembers()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👨‍👩‍👧‍👦 Family</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage family members and calendar sharing.</p>
          </div>
          <button
            onClick={() => { setShowModal(true); setSaveError(null) }}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            + Invite Member
          </button>
        </div>

        {/* Member list */}
        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-16">{error}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-gray-600 font-medium">No family members yet</p>
            <p className="text-sm text-gray-400 mt-1">Invite someone to start sharing calendars and routines.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => {
              const statusMeta = STATUS_META[m.invite_status] ?? STATUS_META.not_invited
              return (
                <div key={m.id} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                    {getInitials(m.name)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                    {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">{ROLE_LABELS[m.role] ?? m.role}</p>
                  </div>
                  {/* Status badge */}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Add member modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Invite a Family Member</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="Jane Hong"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email (optional — for invite)</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="jane@example.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {Object.entries(ROLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
            </div>
            <div className="px-5 pb-5 flex gap-2 justify-end">
              <button
                onClick={() => { setShowModal(false); setSaveError(null) }}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50"
              >
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
