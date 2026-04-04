"use client"

import { useState } from 'react'
import Link from 'next/link'
import FamilyMemberCard, { FamilyMember } from '@/components/FamilyMemberCard'

// TODO: wire to Supabase — fetch family group data
const MOCK_INVITE_CODE = 'FRD-7X2K'
const MOCK_FAMILY_NAME = 'The Johnson Family'

// TODO: wire to Supabase — fetch family_members table
const MOCK_MEMBERS: FamilyMember[] = [
  { id: 'u1', name: 'Sarah Johnson', role: 'Parent/Guardian', color: '#f96400', isSelf: true },
  { id: 'u2', name: 'Mike Johnson', role: 'Parent/Guardian', color: '#3b82f6' },
  { id: 'u3', name: 'Lily Johnson', role: 'Child', color: '#8b5cf6', ageOrGrade: 'Grade 4' },
  { id: 'u4', name: 'Emma Johnson', role: 'Child', color: '#10b981', ageOrGrade: '8' },
]

export default function FamilyPage() {
  // TODO: wire to Supabase — family group state
  const [familyName, setFamilyName] = useState(MOCK_FAMILY_NAME)
  const [editingFamilyName, setEditingFamilyName] = useState(false)
  const [familyNameInput, setFamilyNameInput] = useState(MOCK_FAMILY_NAME)
  const [members, setMembers] = useState<FamilyMember[]>(MOCK_MEMBERS)
  const [copied, setCopied] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [notification, setNotification] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 2500)
  }

  const commitFamilyName = () => {
    setEditingFamilyName(false)
    if (familyNameInput.trim()) {
      setFamilyName(familyNameInput.trim())
      // TODO: wire to Supabase — update family group name
    } else {
      setFamilyNameInput(familyName)
    }
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(MOCK_INVITE_CODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyInviteLink = () => {
    // TODO: wire to Supabase — generate real invite URL
    const link = `https://fraydi.app/join/${MOCK_INVITE_CODE}`
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true)
      showNotification('Invite link copied!')
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  const updateMember = (updated: FamilyMember) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    // TODO: wire to Supabase — update family_members row
  }

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    // TODO: wire to Supabase — delete family_members row
  }

  const addChild = () => {
    if (!newChildName.trim()) return
    const newMember: FamilyMember = {
      id: `child-${Date.now()}`,
      name: newChildName.trim(),
      role: 'Child',
      color: '#14b8a6',
    }
    setMembers((prev) => [...prev, newMember])
    // TODO: wire to Supabase — insert into family_members
    setNewChildName('')
    setAddingChild(false)
    showNotification(`${newMember.name} added!`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {notification}
        </div>
      )}

      {/* Back nav */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-[#f96400] transition-colors flex items-center gap-1"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Family Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          {/* Family Name */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Family Name</label>
            {editingFamilyName ? (
              <input
                autoFocus
                value={familyNameInput}
                onChange={(e) => setFamilyNameInput(e.target.value)}
                onBlur={commitFamilyName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitFamilyName()
                  if (e.key === 'Escape') { setEditingFamilyName(false); setFamilyNameInput(familyName) }
                }}
                className="mt-1 w-full text-xl font-bold text-gray-900 border-b-2 border-[#f96400] focus:outline-none bg-transparent pb-0.5"
              />
            ) : (
              <button
                onClick={() => { setEditingFamilyName(true); setFamilyNameInput(familyName) }}
                className="mt-1 block text-xl font-bold text-gray-900 hover:text-[#f96400] transition-colors text-left w-full"
                title="Click to edit family name"
              >
                {familyName} ✏️
              </button>
            )}
          </div>

          {/* Invite code */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
              <span className="text-xs text-gray-500">Invite code:</span>
              <span className="font-mono font-bold text-gray-900 tracking-widest">{MOCK_INVITE_CODE}</span>
              <button
                onClick={copyInviteCode}
                className="ml-auto text-lg hover:scale-110 transition-transform"
                title="Copy invite code"
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
            <button
              onClick={copyInviteLink}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                inviteCopied
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-[#f96400] text-white hover:bg-[#d95400]'
              }`}
            >
              {inviteCopied ? '✓ Copied!' : '🔗 Share invite link'}
            </button>
          </div>
        </div>

        {/* Member List */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Family Members ({members.length})
          </h2>
          <div className="flex flex-col gap-3">
            {members.map((member) => (
              <FamilyMemberCard
                key={member.id}
                member={member}
                onUpdate={updateMember}
                onRemove={removeMember}
              />
            ))}
          </div>
        </div>

        {/* Add Member section */}
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Add a Member</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Invite via link */}
            <button
              onClick={copyInviteLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#f96400] hover:text-[#f96400] transition-colors bg-gray-50 hover:bg-orange-50"
            >
              📨 Invite via link
              <span className="text-xs font-normal text-gray-400">(copies URL)</span>
            </button>

            {/* Add child/dependent */}
            {!addingChild ? (
              <button
                onClick={() => setAddingChild(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#f96400] hover:text-[#f96400] transition-colors bg-gray-50 hover:bg-orange-50"
              >
                👶 Add child/dependent
              </button>
            ) : (
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addChild()
                    if (e.key === 'Escape') { setAddingChild(false); setNewChildName('') }
                  }}
                  placeholder="Child's name…"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400]"
                />
                <button
                  onClick={addChild}
                  className="px-3 py-2 rounded-xl bg-[#f96400] text-white text-sm font-semibold hover:bg-[#d95400] transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingChild(false); setNewChildName('') }}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
