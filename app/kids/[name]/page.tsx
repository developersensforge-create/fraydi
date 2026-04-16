'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ShoppingList from '@/components/ShoppingList'

type CalEvent = {
  id: string; title: string; start: string; end: string
  isAllDay: boolean; calendarColor?: string; calendarName?: string
}

function getDeviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'America/New_York' }
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: getDeviceTz() })
}
function formatDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

export default function KidDashboard() {
  const params = useParams()
  const name = decodeURIComponent(params.name as string)
  const [todayEvents, setTodayEvents] = useState<CalEvent[]>([])
  const [weekEvents, setWeekEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState<Array<{id: string; content: string; created_at: string; author_name: string}>>([])
  const [familyId, setFamilyId] = useState<string | null>(null)

  const today = new Date()
  const tz = encodeURIComponent(getDeviceTz())

  // Filter events by calendar owner name — use calendarName first (most reliable)
  // Fall back to title keywords only for THIS kid's name, never other kids
  const nameLower = name.toLowerCase()
  const isKidEvent = (e: CalEvent) => {
    // Primary: calendar name contains this kid's name
    const calName = (e.calendarName ?? '').toLowerCase()
    if (calName.includes(nameLower)) return true
    // Secondary: event title contains this kid's name exactly
    const titleLower = e.title.toLowerCase()
    if (titleLower.includes(nameLower)) return true
    // Tertiary: activity keywords — only if calendarName indicates a kid calendar (not adult)
    const isAdultCal = calName.includes('work') || calName.includes('ruizhi') || calName.includes('liwei') || calName.includes('@')
    if (isAdultCal) return false
    const activityKeywords = ['baseball', 'soccer', 'swim', 'fll', 'scioly', 'chess', 'activit', '4v4', 'riverbat', '12u', '6u', 'library']
    return activityKeywords.some(k => calName.includes(k) || titleLower.includes(k))
  }

  // Load family_id + notes from DB
  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(d => {
      if (d.family_id) {
        setFamilyId(d.family_id)
        fetch(`/api/notes?family_id=${d.family_id}`).then(r => r.json()).then(nd => setNotes(nd.notes ?? []))
      }
    }).catch(() => {})
  }, [name])

  const submitNote = async () => {
    if (!note.trim() || !familyId) return
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note.trim(), author_name: name, note_type: 'message', family_id: familyId }),
    }).then(r => r.json())
    if (res.note) setNotes(prev => [res.note, ...prev])
    setNote('')
  }

  useEffect(() => {
    const todayStr = formatDate(today)
    fetch(`/api/user/events?date=${todayStr}&tz=${tz}`)
      .then(r => r.json())
      .then(d => {
        setTodayEvents((d.events ?? []).filter(isKidEvent))
        setLoading(false)
      })

    // Load next 7 days
    Promise.all(
      Array.from({ length: 7 }, (_, i) => addDays(today, i + 1))
        .map(d => fetch(`/api/user/events?date=${formatDate(d)}&tz=${tz}`).then(r => r.json()).catch(() => ({ events: [] })))
    ).then(results => {
      const all = results.flatMap((r, i) =>
        (r.events ?? []).filter(isKidEvent).map((e: any) => ({
          ...e,
          _date: formatDate(addDays(today, i + 1))
        }))
      )
      setWeekEvents(all)
    })
  }, [])

  const greeting = `Hi ${name}! 👋`
  const hour = new Date().getHours()
  const timeGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{timeGreet}, {name}! 🌟</p>
          <p className="text-sm text-gray-400 mt-1">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Today's events */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">📅 Your day today</h2>
          </div>
          <div className="px-4 py-3">
            {loading && <p className="text-xs text-gray-300 text-center py-4">Loading…</p>}
            {!loading && todayEvents.length === 0 && (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm text-gray-500">Nothing on your schedule today!</p>
              </div>
            )}
            <ul className="space-y-2">
              {todayEvents.map(ev => (
                <li key={ev.id} className="flex items-start gap-3 p-2 rounded-xl"
                  style={{ backgroundColor: (ev.calendarColor ?? '#f96400') + '10' }}>
                  <div className="w-1 rounded-full flex-shrink-0 self-stretch"
                    style={{ backgroundColor: ev.calendarColor ?? '#f96400' }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-500">{fmtTime(ev.start)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Getting there — who's driving */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">🚗 Getting there</h2>
          </div>
          <div className="px-4 py-3">
            {todayEvents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No events today</p>
            ) : (
              <ul className="space-y-2">
                {todayEvents.map(ev => (
                  <li key={ev.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700">{ev.title}</span>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Driver TBD</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Notes to parents */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">📝 Leave a note for parents</h2>
          </div>
          <div className="px-4 py-3 space-y-3">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Shopping list, message, reminder..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
              rows={3}
            />
            <button onClick={submitNote}
              className="w-full py-2 bg-[#f96400] text-white text-sm font-semibold rounded-xl hover:bg-[#d95400]">
              Send to parents
            </button>
            {notes.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-400 font-medium">Sent</p>
                {notes.slice(0, 5).map(n => (
                  <div key={n.id} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <p>{n.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming this week */}
        {weekEvents.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">🗓 Coming up this week</h2>
            </div>
            <div className="px-4 py-3">
              <ul className="space-y-2">
                {weekEvents.slice(0, 8).map((ev: any) => (
                  <li key={ev.id + ev._date} className="flex items-center gap-3">
                    <div className="w-8 text-center flex-shrink-0">
                      <p className="text-[10px] text-gray-400">
                        {new Date(ev._date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-sm font-bold text-gray-700">
                        {new Date(ev._date + 'T12:00:00').getDate()}
                      </p>
                    </div>
                    <div className="flex-1 flex items-center gap-2 p-2 rounded-lg"
                      style={{ backgroundColor: (ev.calendarColor ?? '#f96400') + '10' }}>
                      <div className="w-1 h-6 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ev.calendarColor ?? '#f96400' }} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ev.title}</p>
                        <p className="text-xs text-gray-400">{fmtTime(ev.start)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Shopping list */}
        <ShoppingList kidMode />

        {/* Back link */}
        <div className="text-center">
          <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">
            ← Family dashboard
          </a>
        </div>
      </main>
    </div>
  )
}
