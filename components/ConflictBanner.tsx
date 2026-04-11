"use client"

import { useState, useEffect } from 'react'

type ConflictEvent = {
  title: string
  person?: string
  start?: string
  end?: string
}

type Conflict = {
  id: string
  events: ConflictEvent[]
  suggestion?: string
  ai_suggestion?: string
  time?: string
  date?: string
}

export default function ConflictBanner() {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`

    fetch(`/api/conflicts?date=${dateStr}&days=7`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const list: Conflict[] = Array.isArray(data) ? data : data.conflicts || []
          setConflicts(list)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null // Don't show skeleton for this widget — it's supplementary

  if (conflicts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium">
        <span>✅</span>
        <span>No conflicts this week</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-orange-200">
      {/* Banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span className="text-sm font-semibold text-orange-800">
            {conflicts.length} scheduling conflict{conflicts.length !== 1 ? 's' : ''} this week
          </span>
        </div>
        <span className="text-orange-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="bg-white border-t border-orange-100 divide-y divide-gray-50">
          {conflicts.map(conflict => {
            const suggestion = conflict.suggestion || conflict.ai_suggestion
            return (
              <div key={conflict.id} className="px-4 py-3">
                {conflict.date && (
                  <p className="text-xs font-semibold text-orange-600 mb-1.5">
                    {new Date(conflict.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {conflict.time && ` · ${conflict.time}`}
                  </p>
                )}
                <div className="space-y-1 mb-2">
                  {conflict.events?.map((ev, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                      <span>📅</span>
                      <span className="font-medium">{ev.title}</span>
                      {ev.person && <span className="text-gray-400">— {ev.person}</span>}
                    </div>
                  ))}
                </div>
                {suggestion && (
                  <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                    💡 {suggestion}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
