'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

type WatchSource = {
  id: string
  name: string
  type: string
  url?: string | null
  color?: string
  active: boolean
  last_synced_at?: string | null
  event_count?: number
}

type WatchEvent = {
  id: string
  title: string
  event_date?: string | null
  event_time?: string | null
  location?: string | null
  description?: string | null
  price?: string | null
  tags?: string[] | null
  url?: string | null
  interest_level?: string | null
}

const INTEREST_META: Record<string, { icon: string; label: string; colorClass: string }> = {
  watch:      { icon: '👀', label: 'Watching',  colorClass: 'text-gray-500 bg-gray-100' },
  interested: { icon: '⭐', label: 'Interested', colorClass: 'text-yellow-600 bg-yellow-50' },
  hot:        { icon: '🔥', label: 'Must Go',    colorClass: 'text-orange-600 bg-orange-50' },
}

function formatDate(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return 'Date TBD'
  try {
    const d = new Date(dateStr + 'T12:00:00Z')
    const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    return timeStr ? `${datePart} · ${timeStr}` : datePart
  } catch { return dateStr }
}

function groupByMonth(events: WatchEvent[]): Record<string, WatchEvent[]> {
  const groups: Record<string, WatchEvent[]> = {}
  for (const e of events) {
    let key = 'No Date'
    if (e.event_date) {
      try {
        key = new Date(e.event_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      } catch { key = 'No Date' }
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
}

export default function WatchSourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [source, setSource] = useState<WatchSource | null>(null)
  const [events, setEvents] = useState<WatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const profRes = await fetch('/api/user/profile')
      if (!profRes.ok) throw new Error('Not authenticated')
      const prof = await profRes.json()
      if (!prof.family_id) throw new Error('No family found')

      const srcRes = await fetch(`/api/watch/sources?family_id=${prof.family_id}`)
      if (!srcRes.ok) throw new Error('Failed to load sources')
      const srcData = await srcRes.json()
      const found = (srcData.sources ?? []).find((s: WatchSource) => s.id === id)
      if (!found) throw new Error('Source not found')
      setSource(found)

      const evRes = await fetch(`/api/watch/sources/${id}/events`)
      if (evRes.ok) {
        const evData = await evRes.json()
        setEvents(evData.events ?? [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  const handleSync = async () => {
    if (!source) return
    setSyncing(true)
    try {
      await fetch(`/api/watch/sources/${id}/sync`, { method: 'POST' })
      await loadData()
    } catch { /* ignore */ } finally {
      setSyncing(false)
    }
  }

  const grouped = groupByMonth(events)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
        <Link href="/watch" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
          ← Watch Sources
        </Link>

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-16">{error}</div>
        ) : source ? (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{source.name}</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                  {source.last_synced_at
                    ? ` · synced ${new Date(source.last_synced_at).toLocaleDateString()}`
                    : ' · never synced'}
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-xl hover:bg-[#d95400] disabled:opacity-50 transition-colors"
              >
                {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
              </button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500">No events yet.</p>
                <p className="text-sm text-gray-400 mt-1">Hit Sync Now to pull events from this source.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([month, monthEvents]) => (
                  <div key={month}>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{month}</h2>
                    <div className="space-y-2">
                      {monthEvents.map((ev) => {
                        const meta = ev.interest_level ? INTEREST_META[ev.interest_level] : null
                        return (
                          <div key={ev.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm leading-snug">{ev.title}</p>
                                {/* Date + time */}
                                <p className="text-xs text-[#f96400] font-medium mt-1">
                                  📅 {formatDate(ev.event_date, ev.event_time)}
                                </p>
                                {/* Location */}
                                {ev.location && (
                                  <p className="text-xs text-gray-400 mt-0.5">📍 {ev.location}</p>
                                )}
                                {/* Price */}
                                {ev.price && (
                                  <p className="text-xs text-green-600 font-medium mt-0.5">💰 {ev.price}</p>
                                )}
                                {/* Description */}
                                {ev.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ev.description}</p>
                                )}
                                {/* Tags */}
                                {ev.tags && ev.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {ev.tags.map((tag) => (
                                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Link */}
                                {ev.url && (
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#f96400] hover:underline mt-1 inline-block"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View details →
                                  </a>
                                )}
                              </div>
                              {/* Interest badge */}
                              {meta && (
                                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${meta.colorClass}`}>
                                  {meta.icon} {meta.label}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
