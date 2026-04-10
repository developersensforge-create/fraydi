'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type WatchEvent = {
  id: string
  title: string
  event_date?: string
  event_time?: string
  price?: string
  interest_level: 'watch' | 'interested' | 'hot'
  source?: { name: string; color: string }
}

const COLOR_DOTS: Record<string, string> = {
  indigo: 'bg-indigo-400', green: 'bg-green-400', blue: 'bg-blue-400',
  amber: 'bg-amber-400', red: 'bg-red-400', purple: 'bg-purple-400',
}

function colorDot(color?: string) {
  return COLOR_DOTS[color ?? ''] ?? 'bg-gray-400'
}

function toLocalDateStr(dateStr?: string) {
  if (!dateStr) return null
  // dateStr is YYYY-MM-DD — treat as local date (no UTC conversion)
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDay(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  d.setHours(0,0,0,0)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function WatchList() {
  const [events, setEvents] = useState<WatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true); setError(false)
      try {
        const res = await fetch('/api/watch/events?limit=50')
        if (!res.ok) throw new Error()
        const json = await res.json()
        const data: WatchEvent[] = Array.isArray(json) ? json : (json.events ?? [])
        setEvents(data)
      } catch { setError(true) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Partition events
  const today = new Date(); today.setHours(0,0,0,0)
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7)

  const todayEvents = events.filter(e => {
    const d = toLocalDateStr(e.event_date)
    return d && d.getTime() === today.getTime()
  })

  const weekEvents = events.filter(e => {
    const d = toLocalDateStr(e.event_date)
    return d && d >= today && d <= in7days
  })

  const nextUpEvent = events
    .filter(e => {
      const d = toLocalDateStr(e.event_date)
      return d && d > today
    })
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))[0]

  const displayEvents = todayEvents.length > 0 ? todayEvents : []
  const weekCount = weekEvents.length

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📡</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">On Your Radar</h2>
              {!loading && !error && weekCount > 0 && (
                <p className="text-xs text-[#f96400] font-medium mt-0.5">
                  {weekCount} event{weekCount !== 1 ? 's' : ''} this week
                </p>
              )}
            </div>
          </div>
          <Link
            href="/watch"
            className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            See all →
          </Link>
        </div>
      </CardHeader>

      <CardBody>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-2 items-center animate-pulse">
                <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-gray-400 text-center py-3">Could not load radar events.</p>
        ) : events.length === 0 ? (
          // No sources / no events at all
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">Nothing on radar yet.</p>
            <Link href="/watch" className="mt-2 inline-block text-xs font-semibold text-[#f96400] hover:underline">
              Add a source →
            </Link>
          </div>
        ) : displayEvents.length > 0 ? (
          // Today has events
          <ul className="space-y-2">
            {displayEvents.slice(0, 4).map(event => (
              <li key={event.id} className="flex items-start gap-2.5 py-0.5">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${colorDot(event.source?.color)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{event.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.event_time && <span className="text-xs text-[#f96400] font-medium">🕐 {event.event_time}</span>}
                    {event.price && <span className="text-xs text-gray-400">💰 {event.price}</span>}
                    {event.interest_level === 'hot' && <span className="text-xs">🔥</span>}
                  </div>
                </div>
              </li>
            ))}
            {displayEvents.length > 4 && (
              <li className="text-xs text-gray-400 pl-4.5">+{displayEvents.length - 4} more today</li>
            )}
          </ul>
        ) : (
          // No events today — show "nothing today" + next-up teaser
          <div className="space-y-3">
            <p className="text-sm text-gray-400 text-center">Nothing on today's radar.</p>
            {nextUpEvent && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Next up</p>
                <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{nextUpEvent.title}</p>
                <p className="text-xs text-[#f96400] font-medium mt-0.5">
                  {(() => {
                    const d = toLocalDateStr(nextUpEvent.event_date)
                    return d ? formatDay(d) : nextUpEvent.event_date
                  })()}
                  {nextUpEvent.event_time ? ` · ${nextUpEvent.event_time}` : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
