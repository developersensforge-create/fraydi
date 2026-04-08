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
}

const COLOR_PRESETS = ['#f96400','#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899']

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

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchCalendars()
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

        {/* Google Calendar auto-sync notice */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Google Calendar</p>
            <p className="text-xs text-gray-400 mt-0.5">Auto-synced via your Google sign-in · All your Google calendars included</p>
          </div>
          <span className="flex-shrink-0 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">✅ Connected</span>
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
              <div key={cal.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: cal.color + '22' }}>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cal.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{cal.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400">{cal.event_count} event{cal.event_count !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">Synced {formatRelativeTime(cal.last_synced_at)}</span>
                  </div>
                  <p className="text-xs text-gray-300 truncate mt-0.5 font-mono">{cal.ical_url}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Re-sync */}
                  <button onClick={() => handleResync(cal)} disabled={isSyncing === cal.id}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50" title="Re-sync">
                    <svg className={`w-4 h-4 ${isSyncing === cal.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button onClick={() => handleDelete(cal.id, cal.name)} disabled={deletingId === cal.id}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Remove">
                    <svg className={`w-4 h-4 ${deletingId === cal.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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
