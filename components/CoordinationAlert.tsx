'use client'

import { useState } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type ConflictEvent = {
  title: string
  person: string
  color: string
}

type Conflict = {
  id: string
  time: string
  events: ConflictEvent[]
  suggestion: string
}

const MOCK_CONFLICTS: Conflict[] = [
  {
    id: 'c1',
    time: '10:00–11:00am',
    events: [
      { title: 'Dentist appointment', person: 'Emma', color: '#10b981' },
      { title: 'Team standup',        person: 'Mike',  color: '#3b82f6' },
    ],
    suggestion: "Who can cover Emma's dentist?",
  },
]

export default function CoordinationAlert() {
  const [conflicts, setConflicts] = useState<Conflict[]>(MOCK_CONFLICTS)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

  const resolve = (id: string) => {
    setResolvedIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      setConflicts((prev) => prev.filter((c) => c.id !== id))
      setResolvedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 600)
  }

  const visibleConflicts = conflicts.filter((c) => !resolvedIds.has(c.id))

  if (visibleConflicts.length === 0) {
    return (
      <Card variant="bordered">
        <CardBody>
          <div className="flex items-center gap-3 py-1">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-base">✅</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">No conflicts today</p>
              <p className="text-xs text-gray-400">Your family schedule looks clear</p>
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
              {visibleConflicts.length} Conflict{visibleConflicts.length !== 1 ? 's' : ''} Today
            </h2>
            <p className="text-xs text-gray-400">Needs your attention</p>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {visibleConflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`rounded-xl border border-orange-100 bg-orange-50 p-3 transition-opacity ${
                resolvedIds.has(conflict.id) ? 'opacity-50' : 'opacity-100'
              }`}
            >
              {/* Time */}
              <p className="text-xs font-semibold text-orange-700 mb-2">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })} · {conflict.time}
              </p>

              {/* Conflicting events */}
              <div className="space-y-1 mb-2">
                {conflict.events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm">📅</span>
                    <span className="text-sm text-gray-800 font-medium">{ev.title}</span>
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ev.color }}
                    />
                    <span className="text-xs text-gray-500">{ev.person}</span>
                  </div>
                ))}
              </div>

              {/* Suggestion */}
              <p className="text-xs text-orange-600 mb-3">
                💡 {conflict.suggestion}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Assign
                </button>
                <button
                  onClick={() => resolve(conflict.id)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400] transition-colors"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
