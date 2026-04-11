"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import EventCard, { FamilyEvent } from '@/components/EventCard'
import CoordinationAlert from '@/components/CoordinationAlert'
import WatchList from '@/components/WatchList'
import FamilyCalendarGrid from '@/components/FamilyCalendarGrid'
import RoutinesCard from '@/components/RoutinesCard'

type ViewMode = 'Today' | 'Week' | 'Month'

type UnifiedEvent = {
  id: string
  title: string
  start: string
  end: string
  isAllDay: boolean
  calendarName?: string
  calendarColor?: string
  source?: string
  location?: string
  description?: string
}

function toFamilyEvent(e: UnifiedEvent): FamilyEvent & { startIso?: string; endIso?: string } {
  const startTime = e.isAllDay
    ? 'All day'
    : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return {
    id: e.id,
    time: startTime,
    title: e.title || 'Untitled event',
    memberName: e.calendarName ?? 'You',
    memberColor: e.calendarColor ?? '#f96400',
    requiresCoverage: false,
    isAllDay: e.isAllDay,
    startIso: e.start,
    endIso: e.end,
  }
}

function formatDate(date: Date): string {
  // Use local date (not UTC) to avoid timezone shift — e.g. 9pm EDT = next day UTC
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

const VIEW_MODES: ViewMode[] = ['Today', 'Week', 'Month']

export default function DashboardPage() {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [viewMode, setViewMode] = useState<ViewMode>('Today')
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [memberEvents, setMemberEvents] = useState<Array<{
    memberId: string; memberName: string; memberColor: string;
    start: string; end: string; isAllDay: boolean; title?: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [synced, setSynced] = useState(false)
  const [calendarCount, setCalendarCount] = useState<number | null>(null)
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
  const { data: session } = useSession()

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setSynced(false)
    // Ensure current user's Google token is stored for family sharing
    fetch('/api/user/sync-token', { method: 'POST' }).catch(() => {})
    // Load profile ID for coordination features
    fetch('/api/user/profile').then(r => r.json()).then(d => { if (d.family_id) setMyProfileId(d.id ?? null) }).catch(() => {})

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const dateStr = formatDate(currentDate)
    Promise.all([
      fetch(`/api/user/events?date=${dateStr}&tz=${encodeURIComponent(tz)}`).then(r => r.json()),
      fetch(`/api/family/member-events?date=${dateStr}`).then(r => r.json()).catch(() => ({ memberEvents: [] })),
    ]).then(([myData, memberData]) => {
      if (myData.events) {
        setEvents(myData.events.map(toFamilyEvent))
        setSynced(true)
        setCalendarCount((myData.calendarSources ?? []).length || 1)
      }
      setMemberEvents(memberData.memberEvents ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [session, currentDate])

  const isToday = formatDate(currentDate) === formatDate(today)
  const navDelta = viewMode === 'Month' ? 30 : viewMode === 'Week' ? 7 : 1

  // Split all-day vs timed events
  const allDayEvents = events.filter((e) => e.isAllDay)
  const timedEvents = events.filter((e) => !e.isAllDay)

  // Conflict detection: find my timed events that overlap with member events
  const conflictMap = new Map<string, typeof memberEvents>()
  for (const myEv of timedEvents) {
    const myStart = (myEv as any).startIso as string | undefined
    const myEnd = (myEv as any).endIso as string | undefined
    if (!myStart || !myEnd) continue
    const overlapping = memberEvents.filter(me => {
      if (me.isAllDay) return false
      return me.start < myEnd && me.end > myStart
    })
    if (overlapping.length > 0) conflictMap.set(myEv.id, overlapping)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isToday ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋` : 'Family Timeline'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{displayDate(currentDate)}</p>
          </div>
          {!isToday && (
            <button onClick={() => setCurrentDate(today)}
              className="text-xs font-semibold text-[#f96400] border border-orange-200 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition">
              Today
            </button>
          )}
        </div>

        {/* People bar — my calendar + family members */}
        {session && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            {/* Me */}
            <div className="flex items-center gap-2 bg-white border border-[#f96400] rounded-xl px-3 py-2 flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-[#f96400]">
                {(session.user?.name ?? 'R').charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 leading-none">{session.user?.name?.split(' ')[0] ?? 'Me'}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{events.filter(e => !e.isAllDay).length} events</p>
              </div>
            </div>
            {/* Family members with tokens */}
            {memberEvents.length > 0 && (() => {
              const members = new Map<string, { name: string; color: string; count: number }>()
              for (const me of memberEvents) {
                if (!members.has(me.memberId)) members.set(me.memberId, { name: me.memberName, color: me.memberColor, count: 0 })
                members.get(me.memberId)!.count++
              }
              return Array.from(members.values()).map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: m.color }}>
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 leading-none">{m.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{m.count} events</p>
                  </div>
                </div>
              ))
            })()}
            {memberEvents.length === 0 && (
              <div className="flex items-center gap-2 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">L</div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 leading-none">Liwei</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">needs to open app</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Desktop layout: sidebar + main + right */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left sidebar — view toggle ── */}
          <aside className="lg:w-40 flex-shrink-0">
            {/* Mobile: horizontal tabs */}
            <div className="flex lg:hidden gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-4">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                    viewMode === mode
                      ? 'bg-[#f96400] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Desktop: vertical tabs */}
            <div className="hidden lg:flex flex-col gap-1 bg-white rounded-xl border border-gray-200 p-2 sticky top-6">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`w-full py-2 px-3 text-sm font-semibold rounded-lg text-left transition-all ${
                    viewMode === mode
                      ? 'bg-[#f96400] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Main column: Calendar Events + Routines ── */}
          <section className="flex-1 min-w-0 flex flex-col gap-6">

            {/* Calendar Events card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Date header with navigation */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button
                  onClick={() => setCurrentDate((d) => addDays(d, -navDelta))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg"
                  aria-label="Previous"
                >
                  ‹
                </button>

                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">{displayDate(currentDate)}</p>
                  {isToday && (
                    <span className="text-xs text-[#f96400] font-medium">Today</span>
                  )}
                </div>

                <button
                  onClick={() => setCurrentDate((d) => addDays(d, navDelta))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg"
                  aria-label="Next"
                >
                  ›
                </button>
              </div>

              {/* Event count badge */}
              {events.length > 0 && (
                <div className="px-5 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                  </span>
                  {events.some((e) => e.requiresCoverage) && (
                    <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                      ⚠️ {events.filter((e) => e.requiresCoverage).length} need coverage
                    </span>
                  )}
                </div>
              )}

              {/* Family Calendar Grid — 2-column when spouse connected */}
              <div className="px-4 py-3">
                {!session ? (
                  <div className="py-10 text-center">
                    <p className="text-2xl mb-2">📅</p>
                    <p className="text-sm font-medium text-gray-600">Sign in with Google to see your calendar</p>
                  </div>
                ) : myProfileId ? (
                  <FamilyCalendarGrid date={formatDate(currentDate)} myProfileId={myProfileId} />
                ) : (
                  <div className="py-6 text-center text-gray-400 text-sm">Loading…</div>
                )}
              </div>
            </div>

            {/* Routines card (below calendar) */}
            <RoutinesCard />
          </section>

          {/* ── Right column: Conflict Alerts + Watch List ── */}
          {/* Mobile order: Conflict Alerts appears right after Calendar (before Routines) via order classes */}
          <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-6">
            <CoordinationAlert />
            <WatchList />
          </aside>
        </div>
      </main>
    </div>
  )
}
