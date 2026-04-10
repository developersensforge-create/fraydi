'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type InterestLevel = 'watch' | 'interested' | 'hot'

type WatchEvent = {
  id: string
  title: string
  date: string
  location: string
  interest_level: InterestLevel
  source: string
}

const MOCK_WATCH_EVENTS: WatchEvent[] = [
  {
    id: 'w1',
    title: 'Jazz Festival',
    date: 'Sat Apr 12',
    location: 'Miller Park',
    interest_level: 'interested',
    source: 'Township Newsletter',
  },
  {
    id: 'w2',
    title: 'Local Basketball Game',
    date: 'Sun Apr 13',
    location: 'Town Rec Center',
    interest_level: 'watch',
    source: 'Sports Calendar',
  },
]

const INTEREST_ORDER: InterestLevel[] = ['watch', 'interested', 'hot']

const INTEREST_META: Record<InterestLevel, { icon: string; label: string; colorClass: string }> = {
  watch:      { icon: '👀', label: 'Watching',   colorClass: 'text-gray-500 bg-gray-100' },
  interested: { icon: '⭐', label: 'Interested',  colorClass: 'text-yellow-600 bg-yellow-50' },
  hot:        { icon: '🔥', label: 'Must Go',     colorClass: 'text-orange-600 bg-orange-50' },
}

const EVENT_ICONS: Record<string, string> = {
  jazz: '🎵',
  festival: '🎵',
  basketball: '🏀',
  game: '🏀',
  soccer: '⚽',
  concert: '🎶',
  default: '📌',
}

function getEventIcon(title: string): string {
  const lower = title.toLowerCase()
  for (const [key, icon] of Object.entries(EVENT_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return EVENT_ICONS.default
}

type AddSourceModalProps = {
  onClose: () => void
}

function AddSourceModal({ onClose }: AddSourceModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState('ical')
  const [url, setUrl] = useState('')

  const handleAdd = () => {
    // API will be wired by Dylan
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Watch Source</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Township Newsletter"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            >
              <option value="ical">iCal URL</option>
              <option value="rss">RSS Feed</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            />
          </div>
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
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400] transition-colors"
          >
            Add Source
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WatchList() {
  const [events, setEvents] = useState<WatchEvent[]>(MOCK_WATCH_EVENTS)
  const [showAddSource, setShowAddSource] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cycleInterest = useCallback((id: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        const idx = INTEREST_ORDER.indexOf(e.interest_level)
        return { ...e, interest_level: INTEREST_ORDER[(idx + 1) % INTEREST_ORDER.length] }
      })
    )
  }, [])

  const dismiss = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setContextMenu(null)
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
            <button
              onClick={() => setShowAddSource(true)}
              className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
            >
              + Add
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nothing on your radar yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => {
                const meta = INTEREST_META[event.interest_level]
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
                          <p className="text-xs text-gray-400 mt-0.5">{event.date} · {event.location}</p>
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

          <button
            onClick={() => setShowAddSource(true)}
            className="mt-3 w-full text-xs text-gray-400 hover:text-[#f96400] transition-colors text-center py-1"
          >
            Manage Sources
          </button>
        </CardBody>
      </Card>

      {/* Context menu for dismiss */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[120px]"
          style={contextMenu.x ? { top: contextMenu.y, left: contextMenu.x } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <button
            className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left transition-colors"
            onClick={() => dismiss(contextMenu.id)}
          >
            🗑 Dismiss
          </button>
          <button
            className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 text-left transition-colors"
            onClick={() => setContextMenu(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Overlay to close context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
      )}

      {showAddSource && <AddSourceModal onClose={() => setShowAddSource(false)} />}
    </>
  )
}
