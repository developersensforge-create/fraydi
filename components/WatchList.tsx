'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Link from 'next/link'

type InterestLevel = 'watch' | 'interested' | 'hot'

type WatchEvent = {
  id: string
  title: string
  start_time: string
  location?: string | null
  interest_level?: InterestLevel | null
  watch_sources?: { name: string; color: string } | null
  dismissed?: boolean
}

const INTEREST_ORDER: InterestLevel[] = ['watch', 'interested', 'hot']

const INTEREST_META: Record<InterestLevel, { icon: string; label: string; colorClass: string }> = {
  watch:      { icon: '👀', label: 'Watching',  colorClass: 'text-gray-500 bg-gray-100' },
  interested: { icon: '⭐', label: 'Interested', colorClass: 'text-yellow-600 bg-yellow-50' },
  hot:        { icon: '🔥', label: 'Must Go',    colorClass: 'text-orange-600 bg-orange-50' },
}

const EVENT_ICONS: Record<string, string> = {
  jazz: '🎵', festival: '🎵', basketball: '🏀', game: '🏀',
  soccer: '⚽', concert: '🎶', default: '📌',
}

function getEventIcon(title: string): string {
  const lower = title.toLowerCase()
  for (const [key, icon] of Object.entries(EVENT_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return EVENT_ICONS.default
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

export default function WatchList() {
  const [events, setEvents] = useState<WatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const familyIdRef = useRef<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const profRes = await fetch('/api/user/profile')
        if (!profRes.ok) return
        const prof = await profRes.json()
        if (!prof.family_id) return
        familyIdRef.current = prof.family_id
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch(`/api/watch/events?family_id=${prof.family_id}&date=${today}`)
        if (!res.ok) return
        const data = await res.json()
        setEvents((data.events ?? []).filter((e: WatchEvent) => !e.dismissed))
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cycleInterest = useCallback(async (id: string) => {
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    const current: InterestLevel = ev.interest_level ?? 'watch'
    const idx = INTEREST_ORDER.indexOf(current)
    const next = INTEREST_ORDER[(idx + 1) % INTEREST_ORDER.length]
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, interest_level: next } : e))
    try {
      await fetch(`/api/watch/events?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest_level: next }),
      })
    } catch { /* ignore */ }
  }, [events])

  const dismiss = useCallback(async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setContextMenu(null)
    try {
      await fetch(`/api/watch/events?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
    } catch { /* ignore */ }
  }, [])

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ id, x: e.clientX, y: e.clientY })
  }

  const handleTouchStart = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ id, x: 0, y: 0 })
    }, 600)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <>
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">👀</span>
              <h2 className="text-base font-semibold text-gray-900">On Your Radar</h2>
            </div>
            <Link href="/watch" className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors">
              Manage
            </Link>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
          ) : events.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">Nothing on your radar yet.</p>
              <Link href="/watch" className="text-xs text-[#f96400] mt-1 inline-block hover:underline">
                Add a watch source →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => {
                const level: InterestLevel = event.interest_level ?? 'watch'
                const meta = INTEREST_META[level]
                return (
                  <li
                    key={event.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3 cursor-pointer select-none"
                    onClick={() => cycleInterest(event.id)}
                    onContextMenu={(e) => handleContextMenu(e, event.id)}
                    onTouchStart={() => handleTouchStart(event.id)}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-base flex-shrink-0 mt-0.5">{getEventIcon(event.title)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{event.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(event.start_time)}{event.location ? ` · ${event.location}` : ''}
                          </p>
                          {event.watch_sources?.name && (
                            <p className="text-xs mt-0.5" style={{ color: event.watch_sources.color ?? '#6366f1' }}>
                              {event.watch_sources.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${meta.colorClass}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[120px]"
          style={contextMenu.x ? { top: contextMenu.y, left: contextMenu.x } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <button className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left" onClick={() => dismiss(contextMenu.id)}>
            🗑 Dismiss
          </button>
          <button className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 text-left" onClick={() => setContextMenu(null)}>
            Cancel
          </button>
        </div>
      )}

      {contextMenu && <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />}
    </>
  )
}
