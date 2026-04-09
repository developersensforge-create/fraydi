'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Navbar from '@/components/Navbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────

type WatchSource = {
  id: string
  name: string
  url?: string
  type: 'url' | 'ical' | 'manual'
  color: string
  active: boolean
  last_synced_at?: string
  event_count: number
  created_at: string
}

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

type InterestLevel = WatchEvent['interest_level']

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  { name: 'indigo',  bg: 'bg-indigo-500',  dot: 'bg-indigo-400',  hex: '#6366f1' },
  { name: 'green',   bg: 'bg-green-500',   dot: 'bg-green-400',   hex: '#22c55e' },
  { name: 'blue',    bg: 'bg-blue-500',    dot: 'bg-blue-400',    hex: '#3b82f6' },
  { name: 'amber',   bg: 'bg-amber-500',   dot: 'bg-amber-400',   hex: '#f59e0b' },
  { name: 'red',     bg: 'bg-red-500',     dot: 'bg-red-400',     hex: '#ef4444' },
  { name: 'purple',  bg: 'bg-purple-500',  dot: 'bg-purple-400',  hex: '#a855f7' },
]

const TYPE_LABELS: Record<WatchSource['type'], string> = {
  url: 'URL',
  ical: 'iCal',
  manual: 'Manual',
}

const INTEREST_META: Record<InterestLevel, { icon: string; label: string; pill: string }> = {
  watch:      { icon: '👀', label: 'Watch',      pill: 'bg-gray-100 text-gray-600' },
  interested: { icon: '⭐', label: 'Interested', pill: 'bg-yellow-50 text-yellow-700' },
  hot:        { icon: '🔥', label: 'Hot',        pill: 'bg-orange-50 text-orange-600' },
}
const INTEREST_ORDER: InterestLevel[] = ['watch', 'interested', 'hot']

const FILTER_TABS: { key: InterestLevel | 'all'; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'watch',      label: '👀 Watching' },
  { key: 'interested', label: '⭐ Interested' },
  { key: 'hot',        label: '🔥 Hot' },
]

const INTEREST_SUGGESTIONS = ['park', 'family', 'sports', 'kids', 'outdoor', 'music', 'food', 'arts & crafts']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date?: string, time?: string) {
  if (!date) return null
  try {
    const d = new Date(date)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return time ? `${dateStr} at ${time}` : dateStr
  } catch {
    return date
  }
}

function formatSynced(iso?: string) {
  if (!iso) return 'Never'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch {
    return iso
  }
}

function colorDot(color: string) {
  const c = COLORS.find(c => c.name === color || c.hex === color)
  return c ? c.dot : 'bg-gray-400'
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
      {message}
    </div>
  )
}

// ─── Interest Keywords Panel ──────────────────────────────────────────────────

function InterestsPanel() {
  const [keywords, setKeywords] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  // Fetch on mount
  useEffect(() => {
    fetch('/api/watch/interests')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.keywords) setKeywords(data.keywords)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Auto-save with 1s debounce (skip initial load)
  useEffect(() => {
    if (!initialized.current) {
      if (!loading) initialized.current = true
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch('/api/watch/interests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      }).catch(() => {})
    }, 1000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [keywords, loading])

  const addKeyword = (word: string) => {
    const trimmed = word.trim().toLowerCase()
    if (!trimmed || keywords.includes(trimmed)) return
    setKeywords(prev => [...prev, trimmed])
  }

  const removeKeyword = (word: string) => {
    setKeywords(prev => prev.filter(k => k !== word))
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addKeyword(input)
      setInput('')
      setShowInput(false)
    }
    if (e.key === 'Escape') {
      setInput('')
      setShowInput(false)
    }
  }

  const handleAddClick = () => {
    setShowInput(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const suggestions = INTEREST_SUGGESTIONS.filter(s => !keywords.includes(s))

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-base">📌</span>
          <h2 className="text-sm font-semibold text-gray-900">Your Interests</h2>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 ml-6">Fraydi filters radar events to match your interests.</p>
      </CardHeader>
      <CardBody className="!pt-2">
        {loading ? (
          <div className="flex gap-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-7 w-16 rounded-full bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              {keywords.map(kw => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="text-orange-400 hover:text-orange-700 ml-0.5 leading-none transition-colors"
                    aria-label={`Remove ${kw}`}
                  >
                    ×
                  </button>
                </span>
              ))}

              {showInput ? (
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onBlur={() => { if (!input.trim()) setShowInput(false) }}
                  placeholder="Type & press Enter"
                  className="text-xs border border-gray-300 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#f96400] w-36"
                />
              ) : (
                <button
                  onClick={handleAddClick}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-2.5 py-1 rounded-full hover:border-[#f96400] hover:text-[#f96400] transition-colors"
                >
                  + Add
                </button>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1.5">Suggestions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => addKeyword(s)}
                      className="text-xs text-gray-400 border border-gray-200 px-2.5 py-0.5 rounded-full hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────

type AddSourceModalProps = {
  onClose: () => void
  onAdded: (eventCount: number) => void
}

function AddSourceModal({ onClose, onAdded }: AddSourceModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<WatchSource['type']>('url')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState(COLORS[0].name)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const urlPlaceholder = type === 'ical'
    ? 'https://calendar.google.com/calendar/ical/...'
    : 'https://deerfieldoh.myrec.com/info/activities/...'

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/watch/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, url: url.trim() || undefined, color }),
      })
      if (!res.ok) throw new Error('Failed to add source')
      const data = await res.json()
      onAdded(data.event_count ?? 0)
      onClose()
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Add Watch Source</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Township Newsletter"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            />
          </div>

          {/* Type tabs */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {(['url', 'ical', 'manual'] as WatchSource['type'][]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                    type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* URL field (not for manual) */}
          {type !== 'manual' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={urlPlaceholder}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
              />
            </div>
          )}

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                    color === c.name ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400] transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {loading ? 'Adding…' : '+ Add & Sync'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({
  source,
  onSync,
  onDelete,
  syncing,
}: {
  source: WatchSource
  onSync: (id: string) => void
  onDelete: (id: string) => void
  syncing: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0">
      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colorDot(source.color)}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{source.name}</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
            {TYPE_LABELS[source.type]}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {source.event_count} event{source.event_count !== 1 ? 's' : ''} · synced {formatSynced(source.last_synced_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onSync(source.id)}
          disabled={syncing}
          title="Sync now"
          className={`text-xs px-2 py-1 rounded-lg border border-gray-200 font-medium transition-colors ${
            syncing ? 'text-gray-400 bg-gray-50 cursor-wait' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {syncing ? '⏳' : '🔄'}
        </button>
        <button
          onClick={() => onDelete(source.id)}
          title="Delete source"
          className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors font-medium"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onCycleInterest,
  onAddToCalendar,
}: {
  event: WatchEvent
  onCycleInterest: (id: string) => void
  onAddToCalendar: (id: string) => void
}) {
  const meta = INTEREST_META[event.interest_level]
  const dateStr = formatDate(event.event_date, event.event_time)
  const dotColor = event.source
    ? (COLORS.find(c => c.name === event.source!.color || c.hex === event.source!.color)?.dot ?? 'bg-gray-400')
    : 'bg-gray-300'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug">{event.title}</p>
          {dateStr && <p className="text-xs text-gray-500 mt-0.5">🗓 {dateStr}</p>}
          {event.location && <p className="text-xs text-gray-500">📍 {event.location}</p>}
          {event.source && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
              <span className="text-xs text-gray-400">{event.source.name}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onCycleInterest(event.id)}
          className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${meta.pill}`}
          title="Click to change interest level"
        >
          {meta.icon} {meta.label}
        </button>
      </div>

      {event.interest_level === 'hot' && !event.added_to_calendar && (
        <button
          onClick={() => onAddToCalendar(event.id)}
          className="mt-3 text-xs font-semibold text-[#f96400] border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors w-full"
        >
          📅 Add to calendar
        </button>
      )}
      {event.added_to_calendar && (
        <p className="mt-2 text-xs text-green-600 font-medium">✅ Added to calendar</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WatchPage() {
  // Sources state
  const [sources, setSources] = useState<WatchSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState('')
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())

  // Events state
  const [events, setEvents] = useState<WatchEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [filter, setFilter] = useState<InterestLevel | 'all'>('all')

  // UI state
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')

  // ── Fetch sources ──
  const fetchSources = useCallback(async () => {
    setSourcesLoading(true)
    setSourcesError('')
    try {
      const res = await fetch('/api/watch/sources')
      if (!res.ok) throw new Error('Failed to load sources')
      const data = await res.json()
      setSources(Array.isArray(data) ? data : (data.sources ?? []))
    } catch {
      setSourcesError('Could not load sources.')
    } finally {
      setSourcesLoading(false)
    }
  }, [])

  // ── Fetch events ──
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true)
    setEventsError('')
    try {
      const res = await fetch('/api/watch/events')
      if (!res.ok) throw new Error('Failed to load events')
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : (data.events ?? []))
    } catch {
      setEventsError('Could not load events.')
    } finally {
      setEventsLoading(false)
    }
  }, [])

  useEffect(() => { fetchSources() }, [fetchSources])
  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Sync source ──
  const handleSync = async (id: string) => {
    setSyncingIds(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/watch/sources/${id}/sync`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSources(prev => prev.map(s =>
        s.id === id ? { ...s, last_synced_at: new Date().toISOString(), event_count: data.event_count ?? s.event_count } : s
      ))
      await fetchEvents()
      setToast('✅ Sync complete')
    } catch {
      setToast('❌ Sync failed')
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ── Delete source ──
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/watch/sources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSources(prev => prev.filter(s => s.id !== id))
      await fetchEvents()
    } catch {
      setToast('❌ Could not delete source')
    }
  }

  // ── Cycle interest level ──
  const handleCycleInterest = async (id: string) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    const idx = INTEREST_ORDER.indexOf(event.interest_level)
    const next = INTEREST_ORDER[(idx + 1) % INTEREST_ORDER.length]
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === id ? { ...e, interest_level: next } : e))
    try {
      await fetch(`/api/watch/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest_level: next }),
      })
    } catch {
      // Revert on failure
      setEvents(prev => prev.map(e => e.id === id ? { ...e, interest_level: event.interest_level } : e))
    }
  }

  // ── Add to calendar ──
  const handleAddToCalendar = async (id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, added_to_calendar: true } : e))
    try {
      await fetch(`/api/watch/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ added_to_calendar: true }),
      })
      setToast('📅 Added to calendar!')
    } catch {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, added_to_calendar: false } : e))
    }
  }

  // ── Handle source added ──
  const handleSourceAdded = async (_eventCount: number) => {
    setToast('✅ Source added — syncing in background. Hit "Sync now" in a moment to see events.')
    await fetchSources()
    // Wait 3s then refresh events (background scrape may be done)
    setTimeout(async () => { await fetchEvents() }, 3000)
  }

  // ── Filtered events ──
  const filteredEvents = filter === 'all' ? events : events.filter(e => e.interest_level === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">On My Radar 📡</h1>
            <p className="text-gray-500 mt-1 text-sm">Sources Fraydi monitors for events your family might love.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-xl hover:bg-[#d95400] transition-colors shadow-sm flex-shrink-0"
          >
            + Add Source
          </button>
        </div>

        {/* ── Interest Keywords ── */}
        <InterestsPanel />

        {/* ── Sources ── */}
        <Card variant="bordered">
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Sources</h2>
          </CardHeader>
          <CardBody className="!pt-0 !px-0">
            {sourcesLoading ? (
              <div className="space-y-3 px-4 py-3">
                {[1,2].map(i => (
                  <div key={i} className="flex gap-3 items-center animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sourcesError ? (
              <p className="text-sm text-red-500 px-4 py-4">{sourcesError}</p>
            ) : sources.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8 px-4">
                No sources yet — add a website or URL to start monitoring.
              </p>
            ) : (
              sources.map(s => (
                <SourceCard
                  key={s.id}
                  source={s}
                  onSync={handleSync}
                  onDelete={handleDelete}
                  syncing={syncingIds.has(s.id)}
                />
              ))
            )}
          </CardBody>
        </Card>

        {/* ── Radar Events ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Radar Events</h2>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-4 bg-white border border-gray-200 p-1 rounded-xl overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  filter === tab.key
                    ? 'bg-[#f96400] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {eventsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : eventsError ? (
            <p className="text-sm text-red-500 text-center py-6">{eventsError}</p>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">
                {events.length === 0
                  ? 'No events found yet — add a source and sync it.'
                  : `No ${filter === 'all' ? '' : filter + ' '}events to show.`}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onCycleInterest={handleCycleInterest}
                  onAddToCalendar={handleAddToCalendar}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Source Modal */}
      {showAdd && (
        <AddSourceModal
          onClose={() => setShowAdd(false)}
          onAdded={handleSourceAdded}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}
