"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import EventCard, { FamilyEvent } from '@/components/EventCard'
import CoordinationAlert from '@/components/CoordinationAlert'
import WatchList from '@/components/WatchList'
import FamilyCalendarGrid from '@/components/FamilyCalendarGrid'
import WeekView from '@/components/WeekView'
import MonthView from '@/components/MonthView'
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
    : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
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
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
  const [viewStats, setViewStats] = useState<{ events: number; conflicts: number } | null>(null)
  const [kidMembers, setKidMembers] = useState<Array<{ id: string; name: string; color?: string }>>([])
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!session) return
    fetch('/api/user/sync-token', { method: 'POST' }).catch(() => {})
    fetch('/api/user/profile').then(r => r.json()).then(d => { if (d.id) setMyProfileId(d.id) }).catch(() => {})
    fetch('/api/family/members').then(r => r.json()).then(d => {
      setKidMembers((d.members ?? []).filter((m: { id: string; name: string; color?: string; role: string }) => m.role === 'kid'))
    }).catch(() => {})
  }, [session])

  // Compute week/month stats
  useEffect(() => {
    if (viewMode === 'Today') {
      setViewStats(null)
      return
    }
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    function getDaysInView(): Date[] {
      if (viewMode === 'Week') {
        const ws = new Date(currentDate)
        ws.setDate(ws.getDate() - ws.getDay())
        return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d })
      } else {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth()
        const daysInMonth = new Date(y, m + 1, 0).getDate()
        return Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1))
      }
    }

    const days = getDaysInView()
    let cancelled = false

    Promise.all([
      Promise.all(days.map(d => fetch(`/api/user/events?date=${fmt(d)}&tz=${tz}`).then(r => r.json()).catch(() => ({ events: [] })))),
      Promise.all(days.map(d => fetch(`/api/family/conflicts?date=${fmt(d)}`).then(r => r.json()).catch(() => ({ conflicts: [] })))),
    ]).then(([evResults, conflictResults]) => {
      if (cancelled) return
      const totalEvents = (evResults as Array<{ events?: Array<{ isAllDay?: boolean }> }>)
        .reduce((sum, r) => sum + (r.events ?? []).filter(e => !e.isAllDay).length, 0)
      const totalConflicts = (conflictResults as Array<{ conflicts?: unknown[] }>)
        .reduce((sum, r) => sum + (r.conflicts ?? []).length, 0)
      setViewStats({ events: totalEvents, conflicts: totalConflicts })
    })

    return () => { cancelled = true }
  }, [viewMode, currentDate])

  const isToday = formatDate(currentDate) === formatDate(today)
  const navDelta = viewMode === 'Month' ? 30 : viewMode === 'Week' ? 7 : 1

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
                <p className="text-[10px] text-gray-400 mt-0.5">Today</p>
              </div>
            </div>

            {/* Kid member cards */}
            {kidMembers.map(kid => (
              <button key={kid.id} onClick={() => router.push(`/kids/${encodeURIComponent(kid.name)}`)}
                className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 flex-shrink-0 hover:bg-gray-50 transition-colors"
                style={{ borderColor: kid.color ?? '#6366f1' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: kid.color ?? '#6366f1' }}>
                  {kid.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 leading-none">{kid.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Dashboard →</p>
                </div>
              </button>
            ))}

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

            {/* Week / Month summary stats */}
            {viewStats && (
              <div className="flex items-center gap-4 px-1">
                <span className="text-sm font-medium text-gray-600">📅 {viewStats.events} events</span>
                <span className={`text-sm font-medium ${viewStats.conflicts > 0 ? 'text-[#f96400]' : 'text-gray-400'}`}>
                  ⚠️ {viewStats.conflicts} conflict{viewStats.conflicts !== 1 ? 's' : ''}
                </span>
              </div>
            )}

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



              {/* Family Calendar Grid — 2-column when spouse connected */}
              <div className="px-4 py-3">
                {!session ? (
                  <div className="py-10 text-center">
                    <p className="text-2xl mb-2">📅</p>
                    <p className="text-sm font-medium text-gray-600">Sign in with Google to see your calendar</p>
                  </div>
                ) : viewMode === 'Week' ? (
                  <WeekView startDate={currentDate} myProfileId={myProfileId ?? 'loading'} />
                ) : viewMode === 'Month' ? (
                  <MonthView currentDate={currentDate} onSelectDate={d => { setCurrentDate(d); setViewMode('Today') }} />
                ) : (
                  <><div className="text-[10px] text-gray-400 text-right mb-1 font-mono">fraydi v1.8.3</div>
                  <FamilyCalendarGrid date={formatDate(currentDate)} myProfileId={myProfileId ?? 'loading'} /></>
                )}
              </div>
            </div>

            {/* Routines card (below calendar) */}
            <RoutinesCard />
          </section>

          {/* ── Right column: Conflict Alerts + Watch List ── */}
          {/* Mobile order: Conflict Alerts appears right after Calendar (before Routines) via order classes */}
          <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-6">
            <CoordinationAlert date={formatDate(currentDate)} />
            <WatchList date={formatDate(currentDate)} />
          </aside>
        </div>
      </main>
    </div>
  )
}
