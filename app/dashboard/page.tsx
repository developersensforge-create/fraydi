"use client"

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import CoordinationAlert from '@/components/CoordinationAlert'
import WatchList from '@/components/WatchList'
import RoutinesCard from '@/components/RoutinesCard'

type ViewMode = 'Today' | 'Week' | 'Month'
const VIEW_MODES: ViewMode[] = ['Today', 'Week', 'Month']

type UnifiedEvent = {
  id: string
  title: string
  start: string
  end: string
  isAllDay: boolean
  location?: string
  calendarId: string
  calendarName: string
  calendarColor: string
  source: 'google' | 'ical'
  htmlLink?: string
}

type CalendarSource = {
  id: string
  name: string
  color: string
  source: 'google' | 'ical'
}

function formatDate(date: Date): string {
  // Use local date parts to avoid UTC shift
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function displayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function DashboardPage() {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [viewMode, setViewMode] = useState<ViewMode>('Today')
  const [events, setEvents] = useState<UnifiedEvent[]>([])
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([])
  const [loading, setLoading] = useState(false)
  const [synced, setSynced] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'loading' || !session) return
    setLoading(true)
    setSynced(false)
    setNeedsReauth(false)
    const localDate = formatDate(currentDate)
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
    fetch(`/api/user/events?date=${localDate}&tz=${tz}`)
      .then(r => r.json())
      .then(data => {
        if (data.needsReauth) { setNeedsReauth(true); return }
        if (data.events) {
          setEvents(data.events)
          setCalendarSources(data.calendarSources ?? [])
          setSynced(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session, status, currentDate])

  const isToday = formatDate(currentDate) === formatDate(today)
  const navDelta = viewMode === 'Month' ? 30 : viewMode === 'Week' ? 7 : 1

  const allDayEvents = events.filter(e => e.isAllDay)
  const timedEvents = events.filter(e => !e.isAllDay)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isToday ? 'Good morning 👋' : 'Family Timeline'}
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your family.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left sidebar ── */}
          <aside className="lg:w-40 flex-shrink-0">
            <div className="flex lg:hidden gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-4">
              {VIEW_MODES.map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${viewMode === mode ? 'bg-[#f96400] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {mode}
                </button>
              ))}
            </div>
            <div className="hidden lg:flex flex-col gap-1 bg-white rounded-xl border border-gray-200 p-2 sticky top-6">
              {VIEW_MODES.map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`w-full py-2 px-3 text-sm font-semibold rounded-lg text-left transition-all ${viewMode === mode ? 'bg-[#f96400] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                  {mode}
                </button>
              ))}

              {/* Calendar legend */}
              {calendarSources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Calendars</p>
                  <div className="space-y-1.5">
                    {calendarSources.map(cal => (
                      <div key={cal.id} className="flex items-center gap-2 px-1">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                        <span className="text-xs text-gray-600 truncate leading-tight">{cal.name}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/calendars" className="mt-3 block text-xs text-[#f96400] hover:underline px-1">
                    Manage calendars →
                  </Link>
                </div>
              )}
            </div>
          </aside>

          {/* ── Main column ── */}
          <section className="flex-1 min-w-0 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

              {/* Date navigation */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button onClick={() => setCurrentDate(d => addDays(d, -navDelta))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg" aria-label="Previous">‹</button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">{displayDate(currentDate)}</p>
                  {isToday && <span className="text-xs text-[#f96400] font-medium">Today</span>}
                </div>
                <button onClick={() => setCurrentDate(d => addDays(d, navDelta))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg" aria-label="Next">›</button>
              </div>

              {/* Event count */}
              {events.length > 0 && (
                <div className="px-5 py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-400">{events.length} event{events.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Timeline */}
              <div className="px-5 py-4">
                {loading ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">⏳</p>
                    <p className="text-sm font-semibold text-gray-700">Loading events...</p>
                    <p className="text-xs text-gray-400 mt-1">Syncing all calendars</p>
                  </div>
                ) : needsReauth ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">🔑</p>
                    <p className="text-sm font-semibold text-gray-700">Calendar permission needed</p>
                    <p className="text-xs text-gray-400 mt-1 mb-3">Please sign out and sign back in</p>
                    <button onClick={() => signOut({ callbackUrl: '/login' })}
                      className="px-4 py-2 bg-[#f96400] text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition">
                      Sign out &amp; reconnect
                    </button>
                  </div>
                ) : !session ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">📅</p>
                    <p className="text-sm font-semibold text-gray-700">Not signed in</p>
                    <p className="text-xs text-gray-400 mt-1"><a href="/login" className="text-[#f96400] underline">Sign in with Google</a></p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">📅</p>
                    <p className="text-sm font-semibold text-gray-700">No events today</p>
                    <p className="text-xs text-gray-400 mt-1">All calendars synced — nothing scheduled</p>
                  </div>
                ) : (
                  <div>
                    {/* All-day events */}
                    {allDayEvents.length > 0 && (
                      <div className="mb-4 space-y-1">
                        {allDayEvents.map(ev => (
                          <div key={ev.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: ev.calendarColor + '18', borderLeft: `3px solid ${ev.calendarColor}` }}>
                            <span className="font-medium text-gray-800 flex-1 truncate">{ev.title}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{ev.calendarName}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Timed events */}
                    <div className="relative">
                      <div className="absolute left-[3.75rem] top-0 bottom-0 w-px bg-gray-100" />
                      <div className="space-y-0">
                        {timedEvents.map(ev => (
                          <div key={ev.id} className="flex gap-3 py-3 group">
                            {/* Time */}
                            <div className="w-14 flex-shrink-0 text-right">
                              <span className="text-xs text-gray-400 leading-tight">{formatTime(ev.start)}</span>
                            </div>

                            {/* Color dot (on the timeline line) */}
                            <div className="flex-shrink-0 flex flex-col items-center" style={{ zIndex: 1 }}>
                              <span className="w-3 h-3 rounded-full mt-0.5 ring-2 ring-white" style={{ backgroundColor: ev.calendarColor }} />
                            </div>

                            {/* Event details */}
                            <div className="flex-1 min-w-0 pb-2 border-b border-gray-50 group-last:border-0">
                              {ev.htmlLink ? (
                                <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                                  className="text-sm font-medium text-gray-900 hover:text-[#f96400] truncate block leading-tight">
                                  {ev.title}
                                </a>
                              ) : (
                                <p className="text-sm font-medium text-gray-900 truncate leading-tight">{ev.title}</p>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-medium" style={{ color: ev.calendarColor }}>{ev.calendarName}</span>
                                {ev.location && (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-xs text-gray-400 truncate">{ev.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status bar */}
              <div className="mx-5 mb-5 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {loading ? '⏳ Syncing...' : synced
                      ? `✅ ${calendarSources.length} calendar${calendarSources.length !== 1 ? 's' : ''} synced`
                      : '🗓 Connect Google Calendar to see events'}
                  </p>
                  <Link href="/calendars" className="text-xs text-[#f96400] hover:underline">+ Add calendar</Link>
                </div>
              </div>
            </div>

            <RoutinesCard />
          </section>

          {/* ── Right column ── */}
          <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-6">
            <CoordinationAlert />
            <WatchList />
          </aside>
        </div>
      </main>
    </div>
  )
}
