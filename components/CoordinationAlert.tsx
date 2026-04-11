'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type ConflictAlert = {
  id: string
  type: 'no_coverage' | 'split_kids'
  kidEvent: { title: string; start: string; end: string; kidName?: string }
  conflictingAdultEvents: Array<{ personName: string; title: string; color: string }>
  windowStart: string
  windowEnd: string
  suggestion: string
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

export default function CoordinationAlert() {
  const [conflicts, setConflicts] = useState<ConflictAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    fetch(`/api/family/conflicts?date=${today}`)
      .then(r => r.json())
      .then(data => setConflicts(data.conflicts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const resolve = (id: string) => {
    setResolvedIds(prev => new Set([...prev, id]))
    setTimeout(() => {
      setConflicts(prev => prev.filter(c => c.id !== id))
      setResolvedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 600)
  }

  const visible = conflicts.filter(c => !resolvedIds.has(c.id))

  if (loading) {
    return (
      <Card variant="bordered">
        <CardBody>
          <div className="flex items-center gap-3 py-1">
            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 animate-pulse">
              <span className="text-base">📅</span>
            </div>
            <p className="text-sm text-gray-400">Checking conflicts…</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (visible.length === 0) {
    return (
      <Card variant="bordered">
        <CardBody>
          <div className="flex items-center gap-3 py-1">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-base">✅</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">No conflicts today</p>
              <p className="text-xs text-gray-400">Kids are covered — family schedule looks clear</p>
            </div>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {visible.length} Coverage Conflict{visible.length !== 1 ? 's' : ''}
            </h2>
            <p className="text-xs text-gray-400">Kids need a parent available</p>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {visible.map((conflict) => {
            const windowStart = formatTime(conflict.windowStart)
            const windowEnd = formatTime(conflict.windowEnd)
            const isResolved = resolvedIds.has(conflict.id)

            return (
              <div key={conflict.id}
                className={`rounded-xl border border-orange-100 bg-orange-50 p-3 transition-opacity ${isResolved ? 'opacity-50' : ''}`}>

                {/* Kid event */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">🧒</span>
                  <p className="text-sm font-semibold text-orange-900">
                    {conflict.kidEvent.kidName ? `${conflict.kidEvent.kidName}: ` : ''}{conflict.kidEvent.title}
                  </p>
                </div>

                {/* Time window */}
                <p className="text-xs text-orange-700 mb-2">
                  🕐 {windowStart}–{windowEnd} <span className="text-orange-400">(incl. 30min prep)</span>
                </p>

                {/* Busy adults */}
                {conflict.conflictingAdultEvents.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {conflict.conflictingAdultEvents.map((ae, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: ae.color }} />
                        <span className="text-xs text-gray-600">
                          <strong>{ae.personName}</strong> has: {ae.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion */}
                <p className="text-xs text-orange-600 mb-3">💡 {conflict.suggestion}</p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                    Assign
                  </button>
                  <button onClick={() => resolve(conflict.id)}
                    className="flex-1 py-1.5 text-xs font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400]">
                    Resolve
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
