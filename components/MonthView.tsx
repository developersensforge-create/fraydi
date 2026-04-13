'use client'

import { useState, useEffect } from 'react'

type DayEvent = { id: string; title: string; calendarColor?: string }
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function formatDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}
function getDeviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'America/New_York' }
}

export default function MonthView({ currentDate, onSelectDate }: { currentDate: Date; onSelectDate: (d: Date) => void }) {
  const [eventMap, setEventMap] = useState<Record<string, DayEvent[]>>({})
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0=Sun

  // Build calendar grid cells
  const cells: (Date | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, month, d))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  // Fetch all events for the month in batches
  useEffect(() => {
    setLoading(true)
    const tz = encodeURIComponent(getDeviceTz())
    const days: Date[] = []
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

    // Fetch in parallel (batch of 31 — one per day)
    Promise.all(
      days.map(d =>
        fetch(`/api/user/events?date=${formatDate(d)}&tz=${tz}`)
          .then(r => r.json()).catch(() => ({ events: [] }))
      )
    ).then(results => {
      const map: Record<string, DayEvent[]> = {}
      days.forEach((d, i) => {
        const key = formatDate(d)
        map[key] = (results[i].events ?? [])
          .filter((e: any) => !e.isAllDay)
          .slice(0, 3)
          .map((e: any) => ({ id: e.id, title: e.title, calendarColor: e.calendarColor }))
      })
      setEventMap(map)
      setLoading(false)
    })
  }, [year, month])

  const today = formatDate(new Date())
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3 text-center">{monthName}</p>
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
        {/* Day headers */}
        {DAY_LABELS.map(d => (
          <div key={d} className="bg-gray-50 text-center py-1">
            <span className="text-[10px] font-semibold text-gray-400">{d}</span>
          </div>
        ))}
        {/* Calendar cells */}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-white min-h-[60px]" />
          const key = formatDate(day)
          const isToday = key === today
          const events = eventMap[key] ?? []
          return (
            <button key={key}
              onClick={() => onSelectDate(day)}
              className={`bg-white min-h-[60px] p-1 text-left hover:bg-orange-50 transition-colors ${isToday ? 'bg-orange-50' : ''}`}>
              <p className={`text-[11px] font-bold mb-0.5 ${isToday ? 'text-[#f96400]' : 'text-gray-700'}`}>
                {day.getDate()}
              </p>
              {loading ? null : events.map(ev => (
                <div key={ev.id}
                  className="text-[9px] truncate rounded px-0.5 mb-0.5"
                  style={{ backgroundColor: (ev.calendarColor ?? '#f96400') + '25', color: ev.calendarColor ?? '#f96400' }}>
                  {ev.title}
                </div>
              ))}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-2">Tap any day to view details</p>
    </div>
  )
}
