'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

type CalEvent = {
  id: string
  title: string
  start_time: string
  end_time?: string | null
  location?: string | null
  description?: string | null
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const isAllDay = iso.endsWith('T00:00:00Z') || iso.length === 10
    if (isAllDay) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return iso }
}

function groupByMonth(events: CalEvent[]): Record<string, CalEvent[]> {
  const groups: Record<string, CalEvent[]> = {}
  for (const e of events) {
    const key = new Date(e.start_time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
}

export default function WatchSourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [source, setSource] = useState<WatchSource | null>(null)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      // Get family_id first
      const profRes = await fetch('/api/user/profile')
      if (!profRes.ok) throw new Error('Not authenticated')
      const prof = await profRes.json()
      if (!prof.family_id) throw new Error('No family found')

      // Load source details
      const srcRes = await fetch(`/api/watch/sources?family_id=${prof.family_id}`)
      if (!srcRes.ok) throw new Error('Failed to load source')
      const srcData = await srcRes.json()
      const found = (srcData.sources ?? []).find((s: WatchSource) => s.id === id)
      if (!found) throw new Error('Source not found')
      setSource(found)

      // Load ALL events for this source (no date window)
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
        {/* Back */}
        <Link href="/watch" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
          ← Watch Sources
        </Link>

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-16">{error}</div>
        ) : source ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{source.name}</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                  {source.last_synced_at ? ` · last synced ${new Date(source.last_synced_at).toLocaleDateString()}` : ' · never synced'}
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

            {/* Events grouped by month */}
            {events.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500">No events yet.</p>
                <p className="text-sm text-gray-400 mt-1">Hit Sync Now to pull events from this source.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([month, monthEvents]) => (
                  <div key={month}>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{month}</h2>
                    <div className="space-y-2">
                      {monthEvents.map((ev) => (
                        <div key={ev.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                          <p className="font-semibold text-gray-900 text-sm">{ev.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(ev.start_time)}</p>
                          {ev.location && <p className="text-xs text-gray-400 mt-0.5">📍 {ev.location}</p>}
                          {ev.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ev.description}</p>
                          )}
                        </div>
                      ))}
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
