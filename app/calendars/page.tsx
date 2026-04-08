'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

interface CalendarSource {
  id: string
  name: string
  color: string
  last_synced_at: string | null
  event_count: number
  ical_url: string
  active: boolean
}

interface GoogleCal {
  id: string
  summary: string
  googleColor: string
  primary: boolean
  displayName: string
  color: string
  visible: boolean
}

const COLOR_PRESETS = ['#f96400','#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#4285F4','#0f9d58','#f4b400','#db4437']

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function CalendarsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [calendars, setCalendars] = useState<CalendarSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newColor, setNewColor] = useState('#f96400')
  const [isAdding, setIsAdding] = useState(false)
  const [isSyncing, setIsSyncing] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)
  // Google sub-calendars
  const [googleCals, setGoogleCals] = useState<GoogleCal[]>([])
  const [googleLoading, setGoogleLoading] = useState(true)
  const [editingGoogleId, setEditingGoogleId] = useState<string | null>(null)
  const [googleEditName, setGoogleEditName] = useState('')
  const [googleEditColor, setGoogleEditColor] = useState('')
  const [showGoogleColorPicker, setShowGoogleColorPicker] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchCalendars()
    fetchGoogleCals()
  }, [status])

  async function fetchCalendars() {
    setLoading(true)
    try {
      const res = await fetch('/api/user/calendars')
      const data = await res.json()
      if (data.calendars) setCalendars(data.calendars)
    } finally {
      setLoading(false)
    }
  }

  async function fetchGoogleCals() {
    setGoogleLoading(true)
    try {
      const res = await fetch('/api/user/google-cals')
      const data = await res.json()
      if (data.calendars) setGoogleCals(data.calendars)
    } finally {
      setGoogleLoading(false)
    }
  }

  async function saveGooglePref(cal: GoogleCal, patch: Partial<{ display_name: string; color: string; visible: boolean }>) {
    // Optimistic update
    setGoogleCals(prev => prev.map(c => c.id === cal.id ? {
      ...c,
      displayName: patch.display_name ?? c.displayName,
      color: patch.color ?? c.color,
      visible: patch.visible ?? c.visible,
    } : c))
    await fetch('/api/user/google-cals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_calendar_id: cal.id, ...patch }),
    })
  }

  function startGoogleEdit(cal: GoogleCal) {
    setEditingGoogleId(cal.id)
    setGoogleEditName(cal.displayName)
    setGoogleEditColor(cal.color)
    setShowGoogleColorPicker(null)
  }

  async function saveGoogleEdit(cal: GoogleCal) {
    await saveGooglePref(cal, { display_name: googleEditName.trim() || cal.summary, color: googleEditColor })
    setEditingGoogleId(null)
    setShowGoogleColorPicker(null)
  }

  function showStatus(type: 'success' | 'error', text: string) {
    setStatusMsg({ type, text })
    setTimeout(() => setStatusMsg(null), 5000)
  }

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) {
      showStatus('error', 'Please enter a calendar name and URL.')
      return
    }
    setIsAdding(true)
    try {
      const res = await fetch('/api/user/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), url: newUrl.trim(), color: newColor }),
      })
      const data = await res.json()
      if (!res.ok) {
        showStatus('error', data.error || 'Failed to add calendar.')
        return
      }
      setCalendars((prev) => [...prev, data.calendar])
      const count = data.imported ?? 0
      showStatus('success', `"${data.calendar.name}" added! ${count > 0 ? `${count} events imported.` : 'No upcoming events found.'}`)
      if (data.importError) showStatus('error', `Warning: ${data.importError}`)
      setNewName(''); setNewUrl(''); setNewColor('#f96400')
      setShowAddForm(false)
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}"? This will also delete its imported events.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/user/calendars?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { showStatus('error', 'Failed to remove calendar.'); return }
      setCalendars((prev) => prev.filter((c) => c.id !== id))
      showStatus('success', `"${name}" removed.`)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleResync(cal: CalendarSource) {
    setIsSyncing(cal.id)
    try {
      // Re-add with same details to trigger re-import (delete + re-add)
      const delRes = await fetch(`/api/user/calendars?id=${cal.id}`, { method: 'DELETE' })
      if (!delRes.ok) { showStatus('error', 'Sync failed.'); return }
      const addRes = await fetch('/api/user/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cal.name, url: cal.ical_url, color: cal.color }),
      })
      const data = await addRes.json()
      if (!addRes.ok) { showStatus('error', data.error || 'Sync failed.'); return }
      setCalendars((prev) => prev.map((c) => c.id === cal.id ? data.calendar : c))
      showStatus('success', `Synced! ${data.imported} events imported.`)
    } finally {
      setIsSyncing(null)
    }
  }

  async function handleToggle(cal: CalendarSource) {
    const newActive = !cal.active
    // Optimistic update
    setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, active: newActive } : c))
    const res = await fetch(`/api/user/calendars?id=${cal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive }),
    })
    if (!res.ok) {
      // Revert on failure
      setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, active: !newActive } : c))
      showStatus('error', 'Failed to update.')
    }
  }

  function startEdit(cal: CalendarSource) {
    setEditingId(cal.id)
    setEditName(cal.name)
    setEditColor(cal.color)
    setShowColorPicker(null)
  }

  async function saveEdit(cal: CalendarSource) {
    if (!editName.trim()) return
    const res = await fetch(`/api/user/calendars?id=${cal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    })
    if (!res.ok) { showStatus('error', 'Failed to save.'); return }
    setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, name: editName.trim(), color: editColor } : c))
    setEditingId(null)
    setShowColorPicker(null)
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Loading…</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Calendars</h1>
            <p className="text-sm text-gray-500 mt-0.5">Connect calendars from sports leagues, schools, Outlook, and more</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Calendar
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status */}
        {statusMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${statusMsg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {statusMsg.text}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add Calendar</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calendar Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Baseball Team, School Schedule, Work"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calendar URL</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://… or webcal://…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Paste a <code>.ics</code> link or a <code>webcal://</code> subscription URL — both work.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${newColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} disabled={isAdding}
                  className="flex-1 py-2 px-4 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {isAdding ? 'Importing…' : 'Add & Import'}
                </button>
                <button onClick={() => { setShowAddForm(false); setNewName(''); setNewUrl(''); setNewColor('#f96400') }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Google Calendars section ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Google Calendar</p>
              <p className="text-xs text-gray-400">Auto-synced · {googleCals.length} calendars</p>
            </div>
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">✅ Connected</span>
          </div>

          {/* Sub-calendars */}
          {googleLoading ? (
            <div className="px-4 py-4 text-center text-xs text-gray-400">Loading calendars…</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {googleCals.map(cal => (
                <div key={cal.id} className={`px-4 py-3 transition-opacity ${cal.visible ? 'opacity-100' : 'opacity-40'}`}>
                  {editingGoogleId === cal.id ? (
                    <div className="flex items-center gap-3">
                      {/* Color picker */}
                      <div className="relative">
                        <button onClick={() => setShowGoogleColorPicker(showGoogleColorPicker === cal.id ? null : cal.id)}
                          className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-500 transition-colors flex-shrink-0"
                          style={{ backgroundColor: googleEditColor }} />
                        {showGoogleColorPicker === cal.id && (
                          <div className="absolute top-10 left-0 z-20 bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
                            <div className="flex gap-2 flex-wrap w-44">
                              {COLOR_PRESETS.map(c => (
                                <button key={c} onClick={() => { setGoogleEditColor(c); setShowGoogleColorPicker(null) }}
                                  className={`w-7 h-7 rounded-full border-2 transition-transform ${googleEditColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                                  style={{ backgroundColor: c }} />
                              ))}
                            </div>
                            <input type="color" value={googleEditColor} onChange={e => setGoogleEditColor(e.target.value)}
                              className="mt-2 w-full h-7 rounded cursor-pointer" />
                          </div>
                        )}
                      </div>
                      <input type="text" value={googleEditName} onChange={e => setGoogleEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGoogleEdit(cal); if (e.key === 'Escape') setEditingGoogleId(null) }}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      <button onClick={() => saveGoogleEdit(cal)}
                        className="px-2.5 py-1 bg-[#f96400] text-white text-xs font-semibold rounded-lg">Save</button>
                      <button onClick={() => { setEditingGoogleId(null); setShowGoogleColorPicker(null) }}
                        className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                      <span className="flex-1 text-sm text-gray-800 truncate">
                        {cal.displayName}
                        {cal.primary && <span className="ml-1 text-xs text-gray-400">(primary)</span>}
                      </span>
                      {/* Pencil edit */}
                      <button onClick={() => startGoogleEdit(cal)}
                        className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit name & color">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {/* Toggle visible */}
                      <button onClick={() => saveGooglePref(cal, { visible: !cal.visible })}
                        title={cal.visible ? 'Hide from dashboard' : 'Show on dashboard'}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${cal.visible ? 'bg-[#f96400]' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${cal.visible ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar list */}
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-400">Loading calendars…</p>
          </div>
        ) : calendars.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No extra calendars added yet</p>
            <p className="text-xs text-gray-400 mt-1">Add a calendar URL to import events from sports leagues, schools, etc.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calendars.map((cal) => (
              <div key={cal.id} className={`bg-white border rounded-xl p-4 transition-opacity ${cal.active ? 'opacity-100 border-gray-200' : 'opacity-50 border-gray-200'}`}>
                {editingId === cal.id ? (
                  /* ── Edit mode ── */
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {/* Color picker dot */}
                      <div className="relative">
                        <button onClick={() => setShowColorPicker(showColorPicker === cal.id ? null : cal.id)}
                          className="w-9 h-9 rounded-full border-2 border-gray-300 flex-shrink-0 hover:border-gray-500 transition-colors"
                          style={{ backgroundColor: editColor }} title="Change color" />
                        {showColorPicker === cal.id && (
                          <div className="absolute top-10 left-0 z-10 bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
                            <div className="flex gap-2 flex-wrap w-40">
                              {COLOR_PRESETS.map(c => (
                                <button key={c} onClick={() => { setEditColor(c); setShowColorPicker(null) }}
                                  className={`w-7 h-7 rounded-full border-2 transition-transform ${editColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                                  style={{ backgroundColor: c }} />
                              ))}
                            </div>
                            <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                              className="mt-2 w-full h-7 rounded cursor-pointer" />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(cal); if (e.key === 'Escape') setEditingId(null) }}
                        autoFocus
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(cal)}
                        className="px-3 py-1.5 bg-[#f96400] text-white text-xs font-semibold rounded-lg hover:bg-orange-600">Save</button>
                      <button onClick={() => { setEditingId(null); setShowColorPicker(null) }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex items-center gap-3">
                    {/* Color dot — click to start editing */}
                    <button onClick={() => startEdit(cal)}
                      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center hover:ring-2 hover:ring-offset-1 transition-all"
                      style={{ backgroundColor: cal.color + '22' }} title="Edit name & color">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cal.color }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => startEdit(cal)} className="text-sm font-semibold text-gray-900 truncate hover:text-[#f96400] transition-colors text-left w-full">
                        {cal.name}
                      </button>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{cal.event_count} event{cal.event_count !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">Synced {formatRelativeTime(cal.last_synced_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* ✏️ Edit pencil */}
                      <button onClick={() => startEdit(cal)}
                        className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit name & color">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {/* Toggle on/off */}
                      <button onClick={() => handleToggle(cal)} title={cal.active ? 'Hide from dashboard' : 'Show on dashboard'}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${cal.active ? 'bg-[#f96400]' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${cal.active ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      {/* Re-sync */}
                      <button onClick={() => handleResync(cal)} disabled={isSyncing === cal.id}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50" title="Re-sync">
                        <svg className={`w-4 h-4 ${isSyncing === cal.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button onClick={() => handleDelete(cal.id, cal.name)} disabled={deletingId === cal.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Remove">
                        <svg className={`w-4 h-4 ${deletingId === cal.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Help */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-800 mb-2">How to get a calendar URL</p>
          <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
            <li><strong>Google Calendar:</strong> Settings → your calendar → Integrate calendar → Secret address in iCal format</li>
            <li><strong>Apple Calendar:</strong> Share Calendar → check &quot;Public Calendar&quot; → copy link</li>
            <li><strong>Outlook:</strong> Calendar settings → Shared calendars → Publish → ICS link</li>
            <li><strong>Sports/school apps:</strong> Look for &quot;Subscribe&quot; or &quot;Export&quot; — copy the <code className="font-mono">webcal://</code> or <code className="font-mono">.ics</code> link</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
