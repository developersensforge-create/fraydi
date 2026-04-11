'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Routine = {
  id: string
  family_id: string
  family_member_id?: string
  title: string
  description?: string
  type: 'habit' | 'gear' | 'checklist'
  frequency: 'daily' | 'weekly' | 'before_event'
  days_of_week?: number[]
  time_of_day?: string
  active: boolean
  assignee_ids?: string[]
  member?: { name: string; color: string; role: string }
}

type GearSummary = {
  member: { id: string; name: string; role: string; color: string }
  equipment: Array<{
    id: string
    name: string
    description?: string
    remind_external_only: boolean
    event_keywords?: string[]
  }>
}

type FamilyMember = {
  id: string
  name: string
  color: string
  role: string
}

type TodayItem = {
  id: string
  title: string
  type: 'habit' | 'gear'
  member_name?: string
  member_color?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function roleEmoji(role?: string): string {
  if (!role) return '👤'
  const r = role.toLowerCase()
  if (r === 'child' || r === 'kid') return '👦'
  if (r === 'parent' || r === 'adult') return '💑'
  if (r === 'partner') return '💑'
  return '👤'
}

function formatSchedule(routine: Routine): string {
  const time = routine.time_of_day
    ? ` at ${formatTime(routine.time_of_day)}`
    : ''
  if (routine.frequency === 'daily') return `Daily${time}`
  if (routine.frequency === 'weekly') {
    if (routine.days_of_week && routine.days_of_week.length > 0) {
      const days = routine.days_of_week.map((d) => DAY_FULL[d]).join(', ')
      return `Every ${days}${time}`
    }
    return `Weekly${time}`
  }
  if (routine.frequency === 'before_event') return `Before events${time}`
  return ''
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr)
  const m = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
  )
}

// ─── Section: Gear Reminders ──────────────────────────────────────────────────

function GearSection() {
  const [gear, setGear] = useState<GearSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [addingFor, setAddingFor] = useState<string | null>(null) // member id
  const [newItemName, setNewItemName] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemKeywords, setNewItemKeywords] = useState('')
  const [newItemExternal, setNewItemExternal] = useState(false)
  const [savingItem, setSavingItem] = useState(false)

  const addItem = async (memberId: string) => {
    if (!newItemName.trim()) return
    setSavingItem(true)
    try {
      const keywords = newItemKeywords.split(',').map(k => k.trim()).filter(Boolean)
      const res = await fetch(`/api/family/members/${memberId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName.trim(),
          description: newItemDesc.trim() || undefined,
          remind_external_only: newItemExternal,
          event_keywords: keywords,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGear(prev => prev.map(g => g.member.id === memberId
        ? { ...g, equipment: [...g.equipment, data.item] }
        : g))
      setNewItemName(''); setNewItemDesc(''); setNewItemKeywords(''); setNewItemExternal(false); setAddingFor(null)
    } catch { /* silent */ } finally { setSavingItem(false) }
  }

  const removeItem = async (memberId: string, itemId: string) => {
    try {
      await fetch(`/api/family/members/${memberId}/equipment/${itemId}`, { method: 'DELETE' })
      setGear(prev => prev.map(g => g.member.id === memberId
        ? { ...g, equipment: g.equipment.filter(e => e.id !== itemId) }
        : g))
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetch('/api/routines/gear-summary')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setGear(Array.isArray(data) ? data : data?.gear_summary ?? []))
      .catch(() => setGear([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">📦 Gear Reminders</h2>
        <p className="text-xs text-gray-500 mt-0.5">What each family member needs for activities.</p>
      </div>

      {loading ? (
        <div className="p-4">
          <SectionSkeleton />
        </div>
      ) : gear.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-400">No gear set up yet — go to the Family page to add members first.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {gear.map((entry) => {
            const isOpen = !collapsed[entry.member.id]
            return (
              <div key={entry.member.id}>
                {/* Member header — clickable to collapse */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(entry.member.id)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{roleEmoji(entry.member.role)}</span>
                    <span className="font-semibold text-sm text-gray-900">{entry.member.name}</span>
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: entry.member.color || '#f96400' }}
                    />
                    <span className="text-xs text-gray-400">({entry.equipment.length} item{entry.equipment.length !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Equipment list */}
                {isOpen && (
                  <div className="px-5 pb-3">
                    <ul className="space-y-2 mb-3">
                      {entry.equipment.map((item) => (
                        <li key={item.id} className="flex items-start gap-2 group">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800 font-medium">{item.name}</span>
                            {item.description && (
                              <span className="text-xs text-gray-500"> — {item.description}</span>
                            )}
                            {item.event_keywords && item.event_keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.event_keywords.map(k => (
                                  <span key={k} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                                    📅 {k}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.remind_external_only && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                ⚠️ External help only
                              </span>
                            )}
                          </div>
                          <button onClick={() => removeItem(entry.member.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-xs flex-shrink-0">✕</button>
                        </li>
                      ))}
                      {entry.equipment.length === 0 && (
                        <li className="text-xs text-gray-400 italic">No gear added yet</li>
                      )}
                    </ul>
                    {/* Inline add form */}
                    {addingFor === entry.member.id ? (
                      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <input autoFocus type="text" placeholder="Item name (e.g. Baseball bag)"
                          value={newItemName} onChange={e => setNewItemName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addItem(entry.member.id); if (e.key === 'Escape') setAddingFor(null) }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white" />
                        <textarea placeholder="Description (optional, e.g. Keep in car)" rows={2}
                          value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white resize-none" />
                        <input type="text" placeholder="Needed for events (e.g. baseball, work) — comma separated"
                          value={newItemKeywords} onChange={e => setNewItemKeywords(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white" />
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={newItemExternal} onChange={e => setNewItemExternal(e.target.checked)}
                            className="rounded" />
                          Only remind when outside help is involved
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => addItem(entry.member.id)} disabled={savingItem || !newItemName.trim()}
                            className="px-3 py-1.5 bg-[#f96400] text-white text-xs font-semibold rounded-lg hover:bg-[#d95400] disabled:opacity-50 transition">
                            {savingItem ? '...' : 'Add'}
                          </button>
                          <button onClick={() => { setAddingFor(null); setNewItemName(''); setNewItemDesc('') }}
                            className="px-3 py-1.5 border border-gray-200 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingFor(entry.member.id); setNewItemName(''); setNewItemDesc(''); setNewItemExternal(false) }}
                        className="text-xs text-[#f96400] font-medium hover:underline">
                        + Add item for {entry.member.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Hover an item to delete it. Click "+ Add item" under any person to add gear.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section: Recurring Habits ────────────────────────────────────────────────

function HabitsSection() {
  const [habits, setHabits] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<FamilyMember[]>([])

  // Add form state
  const [formTitle, setFormTitle] = useState('')
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]) // empty = Everyone
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekly'>('daily')
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [formTime, setFormTime] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/routines').then((r) => r.ok ? r.json() : []),
      fetch('/api/family').then((r) => r.ok ? r.json() : { family_members: [] }),
    ])
      .then(([routinesData, familyData]) => {
        const allRoutines: Routine[] = Array.isArray(routinesData)
          ? routinesData
          : routinesData?.routines ?? []
        setHabits(allRoutines.filter((r) => !r.type || r.type === 'habit'))

        const memberList: FamilyMember[] = Array.isArray(familyData)
          ? familyData
          : familyData?.family_members ?? familyData?.members ?? []
        setMembers(memberList)
      })
      .catch(() => {
        setHabits([])
        setMembers([])
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleActive = useCallback(async (habit: Routine) => {
    const optimistic = habits.map((h) =>
      h.id === habit.id ? { ...h, active: !h.active } : h
    )
    setHabits(optimistic)
    try {
      await fetch(`/api/routines/${habit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !habit.active }),
      })
    } catch {
      // Revert on error
      setHabits(habits)
    }
  }, [habits])

  const deleteHabit = useCallback(async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    try {
      await fetch(`/api/routines/${id}`, { method: 'DELETE' })
    } catch {
      // noop — optimistic delete
    }
  }, [])

  const toggleDay = (d: number) => {
    setFormDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  const handleAdd = async () => {
    if (!formTitle.trim()) {
      setFormError('Please enter a title.')
      return
    }
    setFormError('')
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: formTitle.trim(),
        type: 'habit',
        frequency: formFrequency,
        time_of_day: formTime || undefined,
      }
      if (formAssigneeIds.length > 0) body.assignee_ids = formAssigneeIds
      else if (formAssigneeIds.length === 0) body.assignee_ids = [] // everyone
      if (formFrequency === 'weekly') body.days_of_week = formDays

      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const created = await res.json()
        const newHabit: Routine = created?.routine ?? created
        setHabits((prev) => [...prev, newHabit])
        setFormTitle('')
        setFormAssigneeIds([])
        setFormFrequency('daily')
        setFormDays([1, 2, 3, 4, 5])
        setFormTime('08:00')
      } else {
        setFormError('Failed to add routine. Please try again.')
      }
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getMemberName = (habit: Routine): string => {
    if (habit.assignee_ids && habit.assignee_ids.length > 0) {
      const names = habit.assignee_ids.map(id => members.find(m => m.id === id)?.name ?? '?')
      return names.join(' & ')
    }
    if (habit.member) return habit.member.name
    if (habit.family_member_id) {
      const m = members.find((m) => m.id === habit.family_member_id)
      return m?.name ?? 'Someone'
    }
    return 'Everyone'
  }

  const getMemberColor = (habit: Routine): string => {
    if (habit.member?.color) return habit.member.color
    if (habit.family_member_id) {
      const m = members.find((m) => m.id === habit.family_member_id)
      return m?.color ?? '#f96400'
    }
    return '#f96400'
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">🔁 Recurring Habits</h2>
        <p className="text-xs text-gray-500 mt-0.5">Standing reminders that repeat on a schedule.</p>
      </div>

      {/* Habit list */}
      {loading ? (
        <div className="p-4">
          <SectionSkeleton />
        </div>
      ) : habits.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-gray-400">No habits yet — add your first routine below.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className={`flex items-center gap-3 px-5 py-4 ${!habit.active ? 'opacity-50' : ''}`}
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{habit.title}</span>
                  {!habit.active && (
                    <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md">
                      Paused
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getMemberColor(habit) }}
                  />
                  <span className="text-xs text-gray-500">{getMemberName(habit)}</span>
                  <span className="text-xs text-gray-400">· {formatSchedule(habit)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggleActive(habit)}
                  className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
                    habit.active
                      ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {habit.active ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors font-medium"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add habit form */}
      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add a habit</h3>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="e.g. Morning vitamins"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#f96400]"
          />
        </div>

        {/* For / Frequency row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Who's responsible
              <span className="text-gray-400 font-normal ml-1">(select all that apply)</span>
            </label>
            <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 overflow-hidden">
              {/* Everyone option */}
              <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                <input type="checkbox"
                  checked={formAssigneeIds.length === 0}
                  onChange={() => setFormAssigneeIds([])}
                  className="rounded accent-[#f96400]" />
                <span className="text-gray-700">Everyone (family)</span>
              </label>
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                  <input type="checkbox"
                    checked={formAssigneeIds.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) setFormAssigneeIds(prev => [...prev, m.id])
                      else setFormAssigneeIds(prev => prev.filter(id => id !== m.id))
                    }}
                    className="rounded accent-[#f96400]" />
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-gray-700">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
            <select
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value as 'daily' | 'weekly')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>

        {/* Day toggles (weekly only) */}
        {formFrequency === 'weekly' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  title={DAY_FULL[i]}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                    formDays.includes(i)
                      ? 'bg-[#f96400] text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Time (optional)</label>
          <input
            type="time"
            value={formTime}
            onChange={(e) => setFormTime(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#f96400]"
          />
        </div>

        {formError && (
          <p className="text-xs text-red-500">{formError}</p>
        )}

        <button
          onClick={handleAdd}
          disabled={saving}
          className="w-full py-2.5 text-sm font-semibold bg-[#f96400] text-white rounded-xl hover:bg-[#d95400] disabled:opacity-60 transition-colors"
        >
          {saving ? 'Adding…' : '+ Add routine'}
        </button>
      </div>
    </div>
  )
}

// ─── Section: Today's Checklist ───────────────────────────────────────────────

function TodaySection() {
  const [items, setItems] = useState<TodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/routines/today')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const raw: TodayItem[] = Array.isArray(data)
          ? data
          : data?.items ?? data?.checklist ?? []
        setItems(raw)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const habits = items.filter((i) => i.type !== 'gear')
  const gear = items.filter((i) => i.type === 'gear')

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">✅ Today&apos;s Checklist</h2>
        <p className="text-xs text-gray-500 mt-0.5">What needs to happen today.</p>
      </div>

      {loading ? (
        <div className="p-4">
          <SectionSkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-gray-500">Nothing scheduled for today 🎉</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {/* Habits group */}
          {habits.length > 0 && (
            <div>
              <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                Habits
              </p>
              {habits.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  checked={!!checked[item.id]}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          )}

          {/* Gear group */}
          {gear.length > 0 && (
            <div>
              <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                Gear
              </p>
              {gear.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  checked={!!checked[item.id]}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item: TodayItem
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-4 h-4 rounded border-gray-300 text-[#f96400] accent-[#f96400] flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {item.title}
        </span>
        {item.member_name && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.member_color || '#f96400' }}
            />
            <span className="text-xs text-gray-400">{item.member_name}</span>
          </div>
        )}
      </div>
    </label>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders &amp; Routines 🔔</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Keep your family running smoothly — gear, habits, and event prep.
          </p>
        </div>

        {/* Three stacked sections */}
        <GearSection />
        <HabitsSection />
        <TodaySection />
      </main>
    </div>
  )
}
