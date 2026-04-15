'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type WatchEvent = {
  id: string
  title: string
  event_date?: string | null
  event_time?: string | null
  price?: string | null
  location?: string | null
  url?: string | null
  interest_level?: 'watch' | 'interested' | 'hot' | null
  watch_sources?: { name: string; color: string } | null
}

const INTEREST_META = {
  watch:      { icon: '👀', label: 'Watching',  colorClass: 'text-gray-500 bg-gray-100' },
  interested: { icon: '⭐', label: 'Interested', colorClass: 'text-yellow-600 bg-yellow-50' },
  hot:        { icon: '🔥', label: 'Must Go',    colorClass: 'text-orange-600 bg-orange-50' },
}

// ── Interest button — tap to cycle or pick from menu ─────────────────────────
const LEVELS: Array<'watch' | 'interested' | 'hot'> = ['watch', 'interested', 'hot']

function InterestButton({ eventId, level: initialLevel, onChanged }: {
  eventId: string
  level: 'watch' | 'interested' | 'hot'
  onChanged: (id: string, level: 'watch' | 'interested' | 'hot') => void
}) {
  const [level, setLevel] = useState(initialLevel)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setLevel(initialLevel) }, [initialLevel])

  const meta = INTEREST_META[level]

  const setInterest = async (lvl: 'watch' | 'interested' | 'hot') => {
    setLevel(lvl)
    setOpen(false)
    onChanged(eventId, lvl)
    await fetch(`/api/watch/events?id=${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interest_level: lvl }),
    }).catch(() => {})
  }

  const addToCalendar = async () => {
    setOpen(false)
    await fetch(`/api/watch/events?id=${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ added_to_calendar: true }),
    }).catch(() => {})
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.colorClass}`}>
        {meta.icon}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 min-w-[140px]">
            {LEVELS.map(lvl => (
              <button key={lvl}
                onClick={() => setInterest(lvl)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 ${level === lvl ? 'font-bold text-[#f96400]' : 'text-gray-700'}`}>
                {INTEREST_META[lvl].icon} {INTEREST_META[lvl].label}
                {level === lvl && <span className="ml-auto text-[#f96400]">✓</span>}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button onClick={addToCalendar}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                📅 Add to calendar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function toLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDay(d: Date): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  d.setHours(0,0,0,0)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function WatchList({ date }: { date?: string }) {
  const [events, setEvents] = useState<WatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [weekCount, setWeekCount] = useState(0)
  const dateStr = date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  useEffect(() => {
    const load = async () => {
      try {
        const profRes = await fetch('/api/user/profile')
        if (!profRes.ok) return
        const prof = await profRes.json()
        if (!prof.family_id) return

        const res = await fetch(`/api/watch/events?family_id=${prof.family_id}&date=${dateStr}`)
        if (!res.ok) return
        const data = await res.json()
        const all: WatchEvent[] = data.events ?? []

        // Count events in next 7 days
        const now = new Date(); now.setHours(0,0,0,0)
        const in7 = new Date(now); in7.setDate(now.getDate() + 7)
        setWeekCount(all.filter(e => {
          const d = toLocalDate(e.event_date)
          return d && d >= now && d <= in7
        }).length)

        setEvents(all)
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [dateStr])

  const today = new Date(); today.setHours(0,0,0,0)
  const todayEvents = events.filter(e => {
    const d = toLocalDate(e.event_date)
    return d && d.getTime() === today.getTime()
  })
  const upcomingEvents = events.filter(e => {
    const d = toLocalDate(e.event_date)
    return d && d > today
  }).slice(0, 3)

  const displayEvents = todayEvents.length > 0 ? todayEvents : upcomingEvents

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">👀</span>
            <h2 className="text-base font-semibold text-gray-900">On Your Radar</h2>
            {weekCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                {weekCount} this week
              </span>
            )}
          </div>
          <Link href="/watch" className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors">
            Manage
          </Link>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
        ) : displayEvents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">Nothing on your radar yet.</p>
            <Link href="/watch" className="text-xs text-[#f96400] mt-1 inline-block hover:underline">
              Add a watch source →
            </Link>
          </div>
        ) : (
          <>
            {todayEvents.length === 0 && upcomingEvents.length > 0 && (
              <p className="text-xs text-gray-400 mb-2">Nothing today — next up:</p>
            )}
            <ul className="space-y-2">
              {displayEvents.map((event) => {
                const level = event.interest_level ?? 'watch'
                const meta = INTEREST_META[level]
                const dateObj = toLocalDate(event.event_date)

                return (
                  <li key={event.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{event.title}</p>

                        {/* Date + time — prominent */}
                        {dateObj && (
                          <p className="text-xs font-medium text-[#f96400] mt-0.5">
                            📅 {formatDay(dateObj)}{event.event_time ? ` · ${event.event_time}` : ''}
                          </p>
                        )}

                        {/* Location */}
                        {event.location && (
                          <p className="text-xs text-gray-400 mt-0.5">📍 {event.location}</p>
                        )}

                        {/* Price */}
                        {event.price && (
                          <p className="text-xs text-green-600 font-medium mt-0.5">💰 {event.price}</p>
                        )}

                        {/* Source + link */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {event.watch_sources?.name && (
                            <p className="text-xs text-gray-400">{event.watch_sources.name}</p>
                          )}
                          {event.url && (
                            <a href={event.url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-[#f96400] font-medium hover:underline">
                              Details →
                            </a>
                          )}
                        </div>
                      </div>

                      <InterestButton eventId={event.id} level={event.interest_level ?? 'watch'}
                        onChanged={(id, lvl) => setEvents(prev => prev.map(e => e.id === id ? {...e, interest_level: lvl} : e))} />
                    </div>
                  </li>
                )
              })}
            </ul>

            {events.length > displayEvents.length && (
              <Link href="/watch" className="mt-3 block text-xs text-center text-gray-400 hover:text-[#f96400] transition-colors">
                +{events.length - displayEvents.length} more events →
              </Link>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}
