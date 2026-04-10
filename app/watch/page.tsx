'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type WatchSource = {
  id: string
  name: string
  type: 'ical' | 'rss' | 'manual'
  url: string
  active: boolean
  lastSynced: string
  eventCount: number
}

const MOCK_SOURCES: WatchSource[] = [
  {
    id: 's1',
    name: 'Township Newsletter',
    type: 'ical',
    url: 'https://township.example.com/events.ics',
    active: true,
    lastSynced: '2 hours ago',
    eventCount: 5,
  },
  {
    id: 's2',
    name: 'Sports Calendar',
    type: 'ical',
    url: 'https://sports.example.com/local.ics',
    active: true,
    lastSynced: '1 hour ago',
    eventCount: 3,
  },
  {
    id: 's3',
    name: 'Community Board',
    type: 'rss',
    url: 'https://community.example.com/feed.xml',
    active: false,
    lastSynced: '2 days ago',
    eventCount: 0,
  },
]

const TYPE_LABELS: Record<string, string> = {
  ical: 'iCal URL',
  rss: 'RSS Feed',
  manual: 'Manual',
}

type AddSourceModalProps = {
  onClose: () => void
  onAdd: (s: WatchSource) => void
}

function AddSourceModal({ onClose, onAdd }: AddSourceModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<WatchSource['type']>('ical')
  const [url, setUrl] = useState('')

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({
      id: `s-${Date.now()}`,
      name: name.trim(),
      type,
      url: url.trim(),
      active: true,
      lastSynced: 'Never',
      eventCount: 0,
    })
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
              onChange={(e) => setType(e.target.value as WatchSource['type'])}
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

export default function WatchPage() {
  const [sources, setSources] = useState<WatchSource[]>(MOCK_SOURCES)
  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState<Set<string>>(new Set())

  const toggleActive = (id: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    )
  }

  const deleteSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  const syncSource = (id: string) => {
    setSyncing((prev) => new Set([...prev, id]))
    setTimeout(() => {
      setSyncing((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, lastSynced: 'just now' } : s))
      )
    }, 1500)
  }

  const addSource = (s: WatchSource) => {
    setSources((prev) => [...prev, s])
  }

  const activeSources = sources.filter((s) => s.active)
  const inactiveSources = sources.filter((s) => !s.active)

  const SourceRow = ({ source }: { source: WatchSource }) => (
    <div className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0">
      <div
        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${source.active ? 'bg-green-400' : 'bg-gray-300'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{source.name}</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
            {TYPE_LABELS[source.type]}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {source.eventCount} event{source.eventCount !== 1 ? 's' : ''} · synced {source.lastSynced}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => syncSource(source.id)}
          className={`text-xs px-2 py-1 rounded-lg border border-gray-200 font-medium transition-colors ${
            syncing.has(source.id)
              ? 'text-gray-400 bg-gray-50 cursor-wait'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          disabled={syncing.has(source.id)}
        >
          {syncing.has(source.id) ? '⏳' : '🔄'}
        </button>
        <button
          onClick={() => toggleActive(source.id)}
          className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
            source.active
              ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {source.active ? 'Active' : 'Paused'}
        </button>
        <button
          onClick={() => deleteSource(source.id)}
          className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👀 Watch List Sources</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage event sources that feed your On Your Radar section.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-xl hover:bg-[#d95400] transition-colors shadow-sm"
          >
            + Add Source
          </button>
        </div>

        <div className="space-y-4">
          {/* Active sources */}
          <Card variant="bordered">
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Active Sources ({activeSources.length})
              </h2>
            </CardHeader>
            <CardBody className="!pt-0 !px-0">
              {activeSources.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No active sources. Add one above.</p>
              ) : (
                activeSources.map((s) => <SourceRow key={s.id} source={s} />)
              )}
            </CardBody>
          </Card>

          {/* Inactive sources */}
          {inactiveSources.length > 0 && (
            <Card variant="bordered">
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Paused Sources ({inactiveSources.length})
                </h2>
              </CardHeader>
              <CardBody className="!pt-0 !px-0">
                {inactiveSources.map((s) => <SourceRow key={s.id} source={s} />)}
              </CardBody>
            </Card>
          )}
        </div>
      </main>

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdd={addSource} />}
    </div>
  )
}
