"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import EventCard, { FamilyEvent } from '@/components/EventCard'
import CoordinationAlert from '@/components/CoordinationAlert'
import WatchList from '@/components/WatchList'
import RoutinesCard from '@/components/RoutinesCard'

type ViewMode = 'Today' | 'Week' | 'Month'

type CalendarEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink?: string
}

function toFamilyEvent(e: CalendarEvent): FamilyEvent {
  const isAllDay = !e.start.dateTime
  const startTime = e.start.dateTime
    ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'All day'
  return {
    id: e.id,
    time: startTime,
    title: e.summary || 'Untitled event',
    memberName: 'You',
    memberColor: '#f96400',
    requiresCoverage: false,
    isAllDay,
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
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
  const [loading, setLoading] = useState(false)
  const [synced, setSynced] = useState(false)
  const [calendarCount, setCalendarCount] = useState<number | null>(null)
  const { data: session } = useSession()

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setSynced(false)
    fetch('/api/calendar/events')
      .then(r => r.json())
      .then(data => {
        if (data.events) {
          setEvents(data.events.map(toFamilyEvent))
          setSynced(true)
          // Try to infer calendar count from the response
          if (data.calendarCount) setCalendarCount(data.calendarCount)
          else setCalendarCount(1)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session, currentDate])

  const isToday = formatDate(currentDate) === formatDate(today)
  const navDelta = viewMode === 'Month' ? 30 : viewMode === 'Week' ? 7 : 1

  // Split all-day vs timed events
  const allDayEvents = events.filter((e) => e.isAllDay)
  const timedEvents = events.filter((e) => !e.isAllDay)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isToday ? 'Good morning 👋' : 'Family Timeline'}
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your family.</p>
        </div>

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

              {/* Timeline */}
              <div className="px-5 py-4">
                {loading ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">⏳</p>
                    <p className="text-sm font-semibold text-gray-700">Loading events...</p>
                    <p className="text-xs text-gray-400 mt-1">Syncing with Google Calendar</p>
                  </div>
                ) : !session ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">📅</p>
                    <p className="text-sm font-semibold text-gray-700">No Google Calendar connected</p>
                    <p className="text-xs text-gray-400 mt-1">Sign in with Google to see your real events</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">📅</p>
                    <p className="text-sm font-semibold text-gray-700">No events today</p>
                    <p className="text-xs text-gray-400 mt-1">Your Google Calendar is connected but nothing is scheduled</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* All-day events band */}
                    {allDayEvents.length > 0 && (
                      <div className="mb-3 pb-3 border-b border-gray-100">
                        {allDayEvents.map((event) => (
                          <EventCard key={event.id} event={event} />
                        ))}
                      </div>
                    )}

                    {/* Timed events timeline */}
                    {timedEvents.length > 0 && (
                      <div className="relative">
                        <div className="absolute left-[4.75rem] top-2 bottom-2 w-px bg-gray-100" />
                        <div className="divide-y divide-gray-50">
                          {timedEvents.map((event) => (
                            <EventCard key={event.id} event={event} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sync status bar */}
              <div className="mx-5 mb-5 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center">
                <p className="text-xs text-gray-400">
                  {loading
                    ? '⏳ Syncing calendar...'
                    : synced
                    ? '✅ Synced with Google Calendar'
                    : '🗓 Connect Google Calendar to see real events'}
                </p>
                {synced && calendarCount !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    {calendarCount} calendar{calendarCount !== 1 ? 's' : ''} synced
                  </p>
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
