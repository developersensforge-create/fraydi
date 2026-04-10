'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type WatchSource = {
  id: string
  name: string
  type: string
  url?: string | null
  active: boolean
  last_synced_at?: string | null
  event_count?: number
}

const TYPE_LABELS: Record<string, string> = {
  ical_url: 'iCal Feed',
  url: 'Web Page (scrape)',
  manual: 'Web Page (scrape)',
  ical: 'iCal Feed',
}

function formatSynced(ts?: string | null): string {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

type AddSourceModalProps = {
  onClose: () => void
  onAdd: (name: string, type: string, url: string) => Promise<void>
}

function AddSourceModal({ onClose, onAdd }: AddSourceModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState('url')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    setErr(null)
    try {
      await onAdd(name.trim(), type, url.trim())
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add source')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Watch Source</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
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
              <option value="url">Web Page (AI scrape)</option>
              <option value="ical_url">iCal Feed (.ics URL)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400] disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WatchPage() {
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [sources, setSources] = useState<WatchSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  const fetchSources = async (fid: string) => {
    const res = await fetch(`/api/watch/sources?family_id=${fid}`)
    if (!res.ok) throw new Error('Failed to load sources')
    const data = await res.json()
    setSources(data.sources ?? [])
  }

  useEffect(() => {
    const init = async () => {
      try {
        const profRes = await fetch('/api/user/profile')
        if (!profRes.ok) throw new Error('Not authenticated')
        const prof = await profRes.json()
        if (!prof.family_id) {
          setLoading(false)
          return
        }
        setFamilyId(prof.family_id)
        await fetchSources(prof.family_id)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const toggleActive = async (source: WatchSource) => {
    try {
      await fetch(`/api/watch/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !source.active }),
      })
      setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, active: !s.active } : s))
    } catch { /* ignore */ }
  }

  const deleteSource = async (id: string) => {
    setDeleting((prev) => new Set([...prev, id]))
    try {
      await fetch(`/api/watch/sources/${id}`, { method: 'DELETE' })
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch { /* ignore */ } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const syncSource = async (id: string) => {
    setSyncing((prev) => new Set([...prev, id]))
    try {
      await fetch(`/api/watch/sources/${id}/sync`, { method: 'POST' })
      if (familyId) await fetchSources(familyId)
    } catch { /* ignore */ } finally {
      setSyncing((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const addSource = async (name: string, type: string, url: string) => {
    if (!familyId) throw new Error('No family found')
    const res = await fetch('/api/watch/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family_id: familyId, name, type, url: url || null }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Failed to add source')
    }
    await fetchSources(familyId)
  }

  const activeSources = sources.filter((s) => s.active)
  const inactiveSources = sources.filter((s) => !s.active)

  const SourceRow = ({ source }: { source: WatchSource }) => (
    <div className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0">
      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${source.active ? 'bg-green-400' : 'bg-gray-300'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/watch/${source.id}`} className="text-sm font-semibold text-gray-900 truncate hover:text-[#f96400] transition-colors">{source.name}</Link>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
            {TYPE_LABELS[source.type] ?? source.type}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {source.event_count ?? 0} event{(source.event_count ?? 0) !== 1 ? 's' : ''} · synced {formatSynced(source.last_synced_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => syncSource(source.id)}
          disabled={syncing.has(source.id)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-wait disabled:text-gray-400"
        >
          {syncing.has(source.id) ? '⏳' : '🔄'}
        </button>
        <button
          onClick={() => toggleActive(source)}
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
          disabled={deleting.has(source.id)}
          className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-50"
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

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-16">{error}</div>
        ) : !familyId ? (
          <div className="text-center py-16">
            <p className="text-gray-500">Set up your family first to manage watch sources.</p>
          </div>
        ) : (
          <div className="space-y-4">
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
        )}
      </main>

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdd={addSource} />}
    </div>
  )
}
