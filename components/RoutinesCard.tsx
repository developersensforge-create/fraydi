'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type TodayRoutine = {
  id: string
  title: string
  type: 'habit' | 'gear' | string
  frequency: string
  time_of_day?: string
  assignee_names?: string[]
  assignee_color?: string
  member?: { name: string; color: string }
  assignee_ids?: string[]
}

function formatTime(t?: string) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

export default function RoutinesCard() {
  const [routines, setRoutines] = useState<TodayRoutine[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/routines/today')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data.routines ?? data.today ?? []
        setRoutines(list)
      })
      .catch(() => setRoutines([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const doneCount = checked.size
  const total = routines.length

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">🔄</span>
              <h2 className="text-base font-semibold text-gray-900">Today&apos;s Routines</h2>
            </div>
            {total > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 ml-7">{doneCount}/{total} done</p>
            )}
          </div>
          <Link href="/routines"
            className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors">
            + Add
          </Link>
        </div>
      </CardHeader>

      <CardBody>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 rounded bg-gray-200 flex-shrink-0" />
                <div className="flex-1 h-4 bg-gray-200 rounded" />
                <div className="w-16 h-3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : routines.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">No routines for today.</p>
            <Link href="/routines" className="mt-1 inline-block text-xs font-semibold text-[#f96400] hover:underline">
              Set up routines →
            </Link>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {routines.map(r => {
              const done = checked.has(r.id)
              const memberObj = (r as any).family_members ?? r.member
              const assignee = memberObj?.name
                ?? (r.assignee_names?.join(' & '))
                ?? 'Everyone'
              const color = memberObj?.color ?? r.assignee_color ?? '#f96400'
              const time = formatTime(r.time_of_day)
              return (
                <li key={r.id}
                  className="flex items-center gap-3 py-1 rounded-lg hover:bg-gray-50 cursor-pointer px-1 transition-colors"
                  onClick={() => toggle(r.id)}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    done ? 'bg-[#f96400] border-[#f96400]' : 'border-gray-300 bg-white'
                  }`}>
                    {done && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className={`flex-1 text-sm font-medium transition-colors ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {r.title}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-400">
                      {assignee}{time ? ` · ${time}` : ''}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
