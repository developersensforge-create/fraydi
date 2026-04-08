'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────

type WatchEvent = {
  id: string
  watch_source_id: string
  title: string
  description?: string
  event_date?: string
  event_time?: string
  location?: string
  url?: string
  interest_level: 'watch' | 'interested' | 'hot'
  added_to_calendar: boolean
  source?: { name: string; color: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_DOTS: Record<string, string> = {
  indigo: 'bg-indigo-400',
  green:  'bg-green-400',
  blue:   'bg-blue-400',
  amber:  'bg-amber-400',
  red:    'bg-red-400',
  purple: 'bg-purple-400',
}

function colorDot(color?: string) {
  if (!color) return 'bg-gray-300'
  return COLOR_DOTS[color] ?? 'bg-gray-400'
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WatchList() {
  const [events, setEvents] = useState<WatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(false)
      try {
        // First try hot events
        let res = await fetch('/api/watch/events?interest_level=hot&limit=5')
        if (!res.ok) throw new Error()
        let data: WatchEvent[] = await res.json()

        // Fall back to interested if no hot events
        if (data.length === 0) {
          res = await fetch('/api/watch/events?interest_level=interested&limit=5')
          if (!res.ok) throw new Error()
          data = await res.json()
        }

        setEvents(data)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📡</span>
            <h2 className="text-base font-semibold text-gray-900">On Your Radar</h2>
          </div>
          <Link
            href="/watch"
            className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
          >
            See all →
          </Link>
        </div>
      </CardHeader>

      <CardBody>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-2 items-center animate-pulse">
                <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error || events.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">
              {error ? 'Could not load radar events.' : 'Nothing on radar yet.'}
            </p>
            <Link
              href="/watch"
              className="mt-2 inline-block text-xs font-semibold text-[#f96400] hover:underline"
            >
              Add a source →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map(event => {
              const dateStr = formatDate(event.event_date)
              const dot = colorDot(event.source?.color)
              return (
                <li key={event.id} className="flex items-start gap-2.5 py-1">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{event.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {dateStr && (
                        <span className="text-xs text-gray-400">{dateStr}</span>
                      )}
                      {event.interest_level === 'hot' && (
                        <span className="text-xs">🔥</span>
                      )}
                      {event.interest_level === 'interested' && (
                        <span className="text-xs">⭐</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
