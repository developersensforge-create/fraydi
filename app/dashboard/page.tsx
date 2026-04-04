"use client"

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import EventCard, { FamilyEvent } from '@/components/EventCard'
import CoordinationAlert from '@/components/CoordinationAlert'
import ShoppingList from '@/components/ShoppingList'

type ViewMode = 'Today' | 'Week' | 'Month'

// TODO: wire to Supabase — fetch from calendar_events joined with family_members
const MOCK_EVENTS_BY_DAY: Record<string, FamilyEvent[]> = {
  '2026-04-04': [
    { id: 'e1', time: '8:00 AM', title: 'School drop-off', memberName: 'Sarah', memberColor: '#f96400', requiresCoverage: false },
    { id: 'e2', time: '10:00 AM', title: 'Dentist appointment', memberName: 'Emma', memberColor: '#10b981', requiresCoverage: true },
    { id: 'e3', time: '3:00 PM', title: 'Soccer practice', memberName: 'Lily', memberColor: '#8b5cf6', requiresCoverage: true },
    { id: 'e4', time: '5:30 PM', title: 'Grocery run', memberName: 'Mike', memberColor: '#3b82f6', requiresCoverage: false },
    { id: 'e5', time: '7:00 PM', title: 'Family dinner', memberName: 'Everyone', memberColor: '#f59e0b', requiresCoverage: false },
  ],
  '2026-04-05': [
    { id: 'e6', time: '9:00 AM', title: 'Piano lesson', memberName: 'Lily', memberColor: '#8b5cf6', requiresCoverage: false },
    { id: 'e7', time: '2:00 PM', title: 'Playdate – Emma & Zoe', memberName: 'Emma', memberColor: '#10b981', requiresCoverage: true },
  ],
  '2026-04-06': [],
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
  const today = new Date('2026-04-04')
  const [currentDate, setCurrentDate] = useState(today)
  const [viewMode, setViewMode] = useState<ViewMode>('Today')

  const dateKey = formatDate(currentDate)
  // TODO: wire to Supabase — replace mock with real event fetch
  const events = MOCK_EVENTS_BY_DAY[dateKey] ?? []

  const isToday = formatDate(currentDate) === formatDate(today)

  const navDelta = viewMode === 'Month' ? 30 : viewMode === 'Week' ? 7 : 1

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
          {/* Left sidebar — view toggle (desktop) / top tabs (mobile) */}
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

          {/* Main — Family Timeline */}
          <section className="flex-1 min-w-0">
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
                {events.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-4xl mb-3">📅</p>
                    <p className="text-sm font-semibold text-gray-700">No events today</p>
                    <p className="text-xs text-gray-400 mt-1">Add a calendar to get started</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[4.75rem] top-2 bottom-2 w-px bg-gray-100" />
                    <div className="divide-y divide-gray-50">
                      {events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Placeholder notice */}
              <div className="mx-5 mb-5 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center">
                <p className="text-xs text-gray-400">
                  {/* TODO: wire to Supabase + Google Calendar */}
                  🗓 Mock data shown · Connect calendars to see real events
                </p>
              </div>
            </div>
          </section>

          {/* Right panel */}
          <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-6">
            {/* TODO: wire to Supabase — coordination_assignments where status = 'pending' */}
            <CoordinationAlert />
            {/* TODO: wire to Supabase — shopping_list table with real-time subscription */}
            <ShoppingList />
          </aside>
        </div>
      </main>
    </div>
  )
}
