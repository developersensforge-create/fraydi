'use client'

import { useState, useEffect } from 'react'

type CalEvent = {
  id: string; title: string; start: string; end: string
  isAllDay: boolean; calendarColor?: string; isKid?: boolean
}

function getDeviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'America/New_York' }
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function formatDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: getDeviceTz() })
}

const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function WeekView({ startDate, myProfileId }: { startDate: Date; myProfileId: string }) {
  const [eventsByDay, setEventsByDay] = useState<Record<string, CalEvent[]>>({})
  const [loading, setLoading] = useState(true)

  // Build week days starting from startDate
  const weekStart = new Date(startDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // go to Sunday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    setLoading(true)
    const tz = encodeURIComponent(getDeviceTz())
    Promise.all(
      days.map(d =>
        fetch(`/api/user/events?date=${formatDate(d)}&tz=${tz}`)
          .then(r => r.json())
          .catch(() => ({ events: [] }))
      )
    ).then(results => {
      const map: Record<string, CalEvent[]> = {}
      days.forEach((d, i) => {
        const key = formatDate(d)
        map[key] = (results[i].events ?? []).map((e: any) => ({
          id: e.id, title: e.title, start: e.start, end: e.end,
          isAllDay: e.isAllDay, calendarColor: e.calendarColor,
        }))
      })
      setEventsByDay(map)
      setLoading(false)
    })
  }, [formatDate(weekStart)])

  const today = formatDate(new Date())

  return (
    <div className="overflow-x-auto">
      {loading && <div className="text-center text-gray-300 text-xs py-6">Loading week…</div>}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden min-w-[560px]">
        {days.map(day => {
          const key = formatDate(day)
          const isToday = key === today
          const events = eventsByDay[key] ?? []
          return (
            <div key={key} className={`bg-white p-2 min-h-[120px] ${isToday ? 'bg-orange-50' : ''}`}>
              <div className={`text-center mb-2`}>
                <p className="text-[10px] text-gray-400">{DAY_SHORT[day.getDay()]}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-[#f96400]' : 'text-gray-700'}`}>
                  {day.getDate()}
                </p>
              </div>
              <div className="space-y-1">
                {events.filter(e => !e.isAllDay).slice(0, 5).map(ev => (
                  <div key={ev.id}
                    className="text-[10px] rounded px-1 py-0.5 truncate"
                    style={{ backgroundColor: (ev.calendarColor ?? '#f96400') + '20', color: ev.calendarColor ?? '#f96400', borderLeft: `2px solid ${ev.calendarColor ?? '#f96400'}` }}>
                    {fmtTime(ev.start)} {ev.title}
                  </div>
                ))}
                {events.filter(e => !e.isAllDay).length > 5 && (
                  <p className="text-[9px] text-gray-400 text-center">+{events.filter(e => !e.isAllDay).length - 5} more</p>
                )}
                {events.length === 0 && !loading && (
                  <p className="text-[9px] text-gray-300 text-center pt-2">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
