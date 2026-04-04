"use client"

import { useState } from 'react'

export type MemberRole = 'Parent/Guardian' | 'Child' | 'Other'

export type FamilyMember = {
  id: string
  name: string
  role: MemberRole
  color: string
  ageOrGrade?: string
  isSelf?: boolean
  photoUrl?: string
}

type Props = {
  member: FamilyMember
  onUpdate: (updated: FamilyMember) => void
  onRemove: (id: string) => void
}

const COLOR_SWATCHES = [
  { name: 'orange', value: '#f96400' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'green', value: '#10b981' },
  { name: 'purple', value: '#8b5cf6' },
  { name: 'red', value: '#ef4444' },
  { name: 'teal', value: '#14b8a6' },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function FamilyMemberCard({ member, onUpdate, onRemove }: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(member.name)

  const commitName = () => {
    setEditingName(false)
    if (nameInput.trim()) {
      onUpdate({ ...member, name: nameInput.trim() })
    } else {
      setNameInput(member.name)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3">
      {/* Top row: avatar + name + remove */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: member.color }}
        >
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.name} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            getInitials(member.name)
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') { setEditingName(false); setNameInput(member.name) }
              }}
              className="w-full text-sm font-semibold text-gray-900 border-b border-orange-400 focus:outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold text-gray-900 hover:text-[#f96400] transition-colors text-left w-full truncate"
              title="Click to edit name"
            >
              {member.name}
              {member.isSelf && <span className="ml-1 text-xs font-normal text-gray-400">(you)</span>}
            </button>
          )}
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(member.id)}
          disabled={member.isSelf}
          className="h-6 w-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 text-base"
          title={member.isSelf ? "You can't remove yourself" : `Remove ${member.name}`}
        >
          ×
        </button>
      </div>

      {/* Role selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-12 flex-shrink-0">Role</label>
        <select
          value={member.role}
          onChange={(e) => onUpdate({ ...member, role: e.target.value as MemberRole })}
          className={`flex-1 text-xs rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#f96400] transition-colors ${
            member.role === 'Parent/Guardian'
              ? 'border-orange-300 bg-orange-50 text-orange-800 font-semibold'
              : 'border-gray-200 text-gray-700'
          }`}
        >
          <option value="Parent/Guardian">Parent/Guardian</option>
          <option value="Child">Child</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Age/Grade — only for Child */}
      {member.role === 'Child' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-12 flex-shrink-0">Age/Grade</label>
          <input
            type="text"
            value={member.ageOrGrade ?? ''}
            onChange={(e) => onUpdate({ ...member, ageOrGrade: e.target.value })}
            placeholder="e.g. 8 or Grade 3"
            className="flex-1 text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#f96400] placeholder-gray-300"
          />
        </div>
      )}

      {/* Color picker */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-12 flex-shrink-0">Color</label>
        <div className="flex gap-1.5">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.name}
              onClick={() => onUpdate({ ...member, color: swatch.value })}
              title={swatch.name}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                member.color === swatch.value ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
              }`}
              style={{ backgroundColor: swatch.value }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
