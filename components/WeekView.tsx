'use client'

import { useState, useEffect } from 'react'

type CalEvent = {
  id: string; title: string; start: string; end: string
  isAllDay: boolean; calendarColor?: string
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
const HOUR_H = 44
const START_H = 7
const END_H = 22

function getNowTopPxWeek(): number | null {
  const tz = getDeviceTz()
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const hour = h === 24 ? 0 : h
  if (hour < START_H || hour >= END_H) return null
  const offsetMins = hour * 60 + m - START_H * 60
  return (offsetMins / 60) * HOUR_H
}

function topPx(iso: string) {
  const tz = getDeviceTz()
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const mins = (h === 24 ? 0 : h) * 60 + m
  return Math.max(0, (mins - START_H * 60) / 60 * HOUR_H)
}
function heightPx(startIso: string, endIso: string) {
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

type DayData = { myEvents: CalEvent[]; spouseEvents: MemberEvent[] }

export default function WeekView({ startDate, myProfileId }: { startDate: Date; myProfileId: string }) {
  const [dayData, setDayData] = useState<Record<string, DayData>>({})
  const [spouseName, setSpouseName] = useState('Partner')
  const [loading, setLoading] = useState(true)
  const [nowLinePx, setNowLinePx] = useState<number | null>(null)

  useEffect(() => {
    setNowLinePx(getNowTopPxWeek())
    const interval = setInterval(() => setNowLinePx(getNowTopPxWeek()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const weekStart = new Date(startDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
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
      let sName = 'Partner'
      days.forEach((d, i) => {
        const key = formatDate(d)
        const [evRes, memberRes] = results[i]
        const myEvs: CalEvent[] = (evRes.events ?? []).filter((e: any) => !e.isAllDay)
        const memberEvs: MemberEvent[] = (memberRes.memberEvents ?? []).filter((me: MemberEvent) => !me.isAllDay)
        if (memberEvs[0]?.memberName) sName = memberEvs[0].memberName.split(' ')[0]
        map[key] = { myEvents: myEvs, spouseEvents: memberEvs }
      })
      setDayData(map)
      setSpouseName(sName)
      setLoading(false)
    })
  }, [weekKey])

  const today = formatDate(new Date())
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const gridHeight = (END_H - START_H) * HOUR_H

  // Summary counts
  const totalEvents = Object.values(dayData).reduce((s, d) => s + d.myEvents.length + d.spouseEvents.length, 0)
  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div>
      {/* Summary bar */}
      {!loading && (
        <div className="flex items-center gap-3 mb-2 px-1 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{weekLabel}</span>
          <span className="bg-gray-100 px-2 py-0.5 rounded-full">{totalEvents} events this week</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: 520 }}>
          {/* Column labels: Me / Spouse per day */}
          <div className="flex mb-0.5" style={{ paddingLeft: 32 }}>
            {days.map(day => {
              const key = formatDate(day)
              const isT = key === today
              return (
                <div key={key} className="flex-1 min-w-0">
                  <div className={`text-center py-1 mx-px rounded-t ${isT ? 'bg-orange-50' : ''}`}>
                    <p className="text-[10px] text-gray-400">{DAY_SHORT[day.getDay()]}</p>
                    <p className={`text-xs font-bold ${isT ? 'text-[#f96400]' : 'text-gray-700'}`}>{day.getDate()}</p>
                  </div>
                  <div className="flex text-[9px] text-gray-400 mx-px">
                    <span className="flex-1 text-center truncate">Me</span>
                    <span className="flex-1 text-center truncate">{spouseName}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {loading && <div className="text-center text-gray-300 text-xs py-8">Loading week…</div>}

          {!loading && (
            <div className="flex">
              {/* Time axis */}
              <div className="flex-shrink-0" style={{ width: 32, height: gridHeight }}>
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_H }} className="flex items-start justify-end pr-1">
                    <span className="text-[9px] text-gray-400 -translate-y-1.5">
                      {h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
                    </span>
                  </div>
                ))}
              </div>

              {/* 7 day columns — each split Me | Spouse */}
              <div className="flex flex-1 gap-px">
                {days.map(day => {
                  const key = formatDate(day)
                  const data = dayData[key] ?? { myEvents: [], spouseEvents: [] }
                  const isT = key === today
                  return (
                    <div key={key} className={`relative flex-1 min-w-0 ${isT ? 'bg-orange-50/30' : 'bg-white'}`}
                      style={{ height: gridHeight, borderLeft: '1px solid #f3f4f6' }}>
                      {/* Hour lines */}
                      {hours.map(h => (
                        <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: (h - START_H) * HOUR_H }} />
                      ))}
                      {/* Center divider */}
                      <div className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: '50%' }} />

                      {/* My events — left half */}
                      {data.myEvents.map(ev => (
                        <div key={ev.id}
                          title={`${fmtTime(ev.start)} ${ev.title}`}
                          className="absolute rounded overflow-hidden"
                          style={{
                            top: topPx(ev.start),
                            height: Math.max(heightPx(ev.start, ev.end), 16),
                            left: 0, right: '50%',
                            backgroundColor: (ev.calendarColor ?? '#f96400') + '18',
                            borderLeft: `2px solid ${ev.calendarColor ?? '#f96400'}`,
                            zIndex: 10,
                          }}>
                          <p className="text-[8px] font-semibold leading-tight px-0.5 pt-0.5 truncate"
                            style={{ color: ev.calendarColor ?? '#f96400' }}>
                            {fmtTime(ev.start)}
                          </p>
                          <p className="text-[8px] text-gray-800 leading-tight px-0.5 truncate">{ev.title}</p>
                        </div>
                      ))}

                      {/* Current time marker — only in today's column */}
                      {isT && nowLinePx !== null && (
                        <div className="absolute left-0 right-0 pointer-events-none" style={{ top: nowLinePx, zIndex: 20 }}>
                          <div className="absolute" style={{ left: 0, top: -3, width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                          <div style={{ height: 2, backgroundColor: '#ef4444', marginLeft: 6 }} />
                        </div>
                      )}

                      {/* Spouse events — right half */}
                      {data.spouseEvents.map((ev, i) => (
                        <div key={ev.start + i}
                          title={`${fmtTime(ev.start)} ${ev.title ?? ''}`}
                          className="absolute rounded overflow-hidden"
                          style={{
                            top: topPx(ev.start),
                            height: Math.max(heightPx(ev.start, ev.end), 16),
                            left: '50%', right: 0,
                            backgroundColor: (ev.memberColor ?? '#6366f1') + '18',
                            borderLeft: `2px solid ${ev.memberColor ?? '#6366f1'}`,
                            zIndex: 10,
                          }}>
                          <p className="text-[8px] font-semibold leading-tight px-0.5 pt-0.5 truncate"
                            style={{ color: ev.memberColor ?? '#6366f1' }}>
                            {fmtTime(ev.start)}
                          </p>
                          <p className="text-[8px] text-gray-800 leading-tight px-0.5 truncate">{ev.title ?? ''}</p>
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
    </div>
  )
}
