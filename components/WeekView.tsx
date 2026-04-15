'use client'

import { useState, useEffect } from 'react'

type CalEvent = {
  id: string; title: string; start: string; end: string
  isAllDay: boolean; calendarColor?: string; calendarName?: string
}
type MemberEvent = {
  memberId: string; memberName: string; memberColor: string
  start: string; end: string; isAllDay: boolean; title?: string
}

function getDeviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'America/New_York' }
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: getDeviceTz() })
}

const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const HOUR_H = 48   // px per hour in week view
const START_H = 7   // 7am
const END_H = 22    // 10pm

function topPct(iso: string) {
  const tz = getDeviceTz()
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const mins = (h === 24 ? 0 : h) * 60 + m
  return Math.max(0, (mins - START_H * 60) / 60 * HOUR_H)
}
function heightPct(startIso: string, endIso: string) {
  const tz = getDeviceTz()
  function mins(iso: string) {
    const d = new Date(iso)
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d)
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
    return (h === 24 ? 0 : h) * 60 + m
  }
  let e = mins(endIso), s = mins(startIso)
  if (e <= s) e += 24 * 60
  return Math.max(30, e - s) / 60 * HOUR_H
}

type DayData = { myEvents: CalEvent[]; spouseEvents: MemberEvent[]; spouseName: string; spouseColor: string }

export default function WeekView({ startDate, myProfileId }: { startDate: Date; myProfileId: string }) {
  const [dayData, setDayData] = useState<Record<string, DayData>>({})
  const [loading, setLoading] = useState(true)

  const weekStart = new Date(startDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekKey = formatDate(weekStart)

  useEffect(() => {
    setLoading(true)
    const tz = encodeURIComponent(getDeviceTz())
    Promise.all(days.map(d => Promise.all([
      fetch(`/api/user/events?date=${formatDate(d)}&tz=${tz}`).then(r => r.json()).catch(() => ({ events: [] })),
      fetch(`/api/family/member-events?date=${formatDate(d)}`).then(r => r.json()).catch(() => ({ memberEvents: [] })),
    ]))).then(results => {
      const map: Record<string, DayData> = {}
      days.forEach((d, i) => {
        const key = formatDate(d)
        const [evRes, memberRes] = results[i]
        const myEvs: CalEvent[] = (evRes.events ?? []).filter((e: any) => !e.isAllDay)
        const memberEvs: MemberEvent[] = (memberRes.memberEvents ?? []).filter((me: MemberEvent) => !me.isAllDay)
        const spouseEv = memberEvs[0]
        map[key] = {
          myEvents: myEvs,
          spouseEvents: memberEvs,
          spouseName: spouseEv?.memberName ?? 'Partner',
          spouseColor: spouseEv?.memberColor ?? '#6366f1',
        }
      })
      setDayData(map)
      setLoading(false)
    })
  }, [weekKey])

  const today = formatDate(new Date())
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const gridHeight = (END_H - START_H) * HOUR_H

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 560 }}>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 mb-px" style={{ paddingLeft: 36 }}>
          {days.map(day => {
            const key = formatDate(day)
            const isT = key === today
            return (
              <div key={key} className={`bg-white px-1 py-1.5 text-center ${isT ? 'bg-orange-50' : ''}`}>
                <p className="text-[10px] text-gray-400">{DAY_SHORT[day.getDay()]}</p>
                <p className={`text-sm font-bold ${isT ? 'text-[#f96400]' : 'text-gray-700'}`}>{day.getDate()}</p>
              </div>
            )
          })}
        </div>

        {loading && <div className="text-center text-gray-300 text-xs py-8">Loading week…</div>}

        {/* Time grid + events */}
        {!loading && (
          <div className="flex">
            {/* Time axis */}
            <div className="flex-shrink-0" style={{ width: 36, height: gridHeight }}>
              {hours.map(h => (
                <div key={h} style={{ height: HOUR_H }} className="flex items-start justify-end pr-1">
                  <span className="text-[9px] text-gray-400 -translate-y-1.5">
                    {h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
                  </span>
                </div>
              ))}
            </div>

            {/* 7 day columns */}
            <div className="flex-1 grid grid-cols-7 gap-px bg-gray-200">
              {days.map(day => {
                const key = formatDate(day)
                const data = dayData[key] ?? { myEvents: [], spouseEvents: [], spouseName: 'Partner', spouseColor: '#6366f1' }
                const isT = key === today
                return (
                  <div key={key} className={`relative ${isT ? 'bg-orange-50/40' : 'bg-white'}`} style={{ height: gridHeight }}>
                    {/* Hour lines */}
                    {hours.map(h => (
                      <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: (h - START_H) * HOUR_H }} />
                    ))}

                    {/* My events — left half */}
                    {data.myEvents.map(ev => (
                      <div key={ev.id}
                        title={`${fmtTime(ev.start)} ${ev.title}`}
                        className="absolute rounded overflow-hidden"
                        style={{
                          top: topPct(ev.start),
                          height: Math.max(heightPct(ev.start, ev.end), 18),
                          left: 0, right: '50%',
                          backgroundColor: (ev.calendarColor ?? '#f96400') + '20',
                          borderLeft: `2px solid ${ev.calendarColor ?? '#f96400'}`,
                          zIndex: 10,
                        }}>
                        <p className="text-[9px] font-medium leading-tight px-0.5 pt-0.5 truncate"
                          style={{ color: ev.calendarColor ?? '#f96400' }}>
                          {fmtTime(ev.start)}
                        </p>
                        <p className="text-[9px] font-semibold text-gray-800 leading-tight px-0.5 truncate">{ev.title}</p>
                      </div>
                    ))}

                    {/* Spouse events — right half */}
                    {data.spouseEvents.map((ev, i) => (
                      <div key={ev.start + i}
                        title={`${fmtTime(ev.start)} ${ev.title ?? ''}`}
                        className="absolute rounded overflow-hidden"
                        style={{
                          top: topPct(ev.start),
                          height: Math.max(heightPct(ev.start, ev.end), 18),
                          left: '50%', right: 0,
                          backgroundColor: (ev.memberColor ?? '#6366f1') + '20',
                          borderLeft: `2px solid ${ev.memberColor ?? '#6366f1'}`,
                          zIndex: 10,
                        }}>
                        <p className="text-[9px] font-medium leading-tight px-0.5 pt-0.5 truncate"
                          style={{ color: ev.memberColor ?? '#6366f1' }}>
                          {fmtTime(ev.start)}
                        </p>
                        <p className="text-[9px] font-semibold text-gray-800 leading-tight px-0.5 truncate">{ev.title ?? ''}</p>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
