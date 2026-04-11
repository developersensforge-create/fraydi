'use client'

import { useState, useEffect } from 'react'

type CalEvent = {
  id: string
  title: string
  start: string
  end: string
  isAllDay: boolean
  calendarName?: string
  calendarColor?: string
  source?: string
  isKid?: boolean
  kidName?: string
  assignedToProfileId?: string | null
}

type MemberEvent = {
  memberId: string
  memberName: string
  memberColor: string
  start: string
  end: string
  isAllDay: boolean
  title?: string
}

type Profile = { id: string; name: string; color: string }

type Assignment = {
  id: string
  event_id: string
  assigned_to: string   // profile id OR 'none' OR 'both'
  status: string
}

type Notification = {
  id: string
  type: string
  title: string
  body?: string
  action_url?: string
  reference_id?: string
}

function formatTime(iso: string, tz?: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
      timeZone: tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  } catch { return '' }
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Event pill component ────────────────────────────────────────────────────
function EventPill({ event, color, onAssign, assignment, myProfileId, spouseProfile, switchLoading, onSwitch }:
  { event: CalEvent; color: string; onAssign?: (eventId: string, profileId: string | null) => void
    assignment?: Assignment | null; myProfileId?: string; spouseProfile?: Profile | null
    switchLoading?: boolean; onSwitch?: (assignmentId: string) => void }
) {
  const isAssignedToMe = assignment?.assigned_to === myProfileId
  const isAssignedToSpouse = spouseProfile && assignment?.assigned_to === spouseProfile.id
  const isUnassigned = !assignment

  return (
    <div className={`rounded-xl border px-3 py-2 mb-1.5 transition-all ${
      isUnassigned ? 'border-orange-200 bg-orange-50' :
      isAssignedToMe ? 'border-[#f96400] bg-white' : 'border-gray-200 bg-white opacity-70'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{formatTime(event.start)}</p>
          {event.kidName && (
            <p className="text-xs font-medium mt-0.5" style={{ color }}>🧒 {event.kidName}</p>
          )}
        </div>

        {/* Assignment controls for kids events */}
        {event.isKid && onAssign && myProfileId && (
          <div className="flex flex-col gap-1 items-end flex-shrink-0">
            {isUnassigned ? (
              <div className="flex flex-wrap gap-1 justify-end">
                <button onClick={() => onAssign(event.id, myProfileId)}
                  className="text-[10px] font-semibold bg-[#f96400] text-white px-2 py-1 rounded-lg hover:bg-[#d95400]">
                  Me
                </button>
                {spouseProfile && (
                  <button onClick={() => onAssign(event.id, spouseProfile.id)}
                    className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200">
                    {spouseProfile.name.split(' ')[0]}
                  </button>
                )}
                <button onClick={() => onAssign(event.id, 'both')}
                  className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100">
                  Both
                </button>
                <button onClick={() => onAssign(event.id, 'none')}
                  className="text-[10px] font-semibold bg-gray-50 text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100">
                  No need
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 font-medium">
                  {assignment?.assigned_to === 'both' ? '✓ Both' :
                   assignment?.assigned_to === 'none' ? '✓ No need' :
                   isAssignedToMe ? '✓ You' :
                   isAssignedToSpouse ? `✓ ${spouseProfile?.name.split(' ')[0]}` : '✓'}
                </span>
                {assignment && onSwitch && assignment.assigned_to !== 'both' && assignment.assigned_to !== 'none' && (
                  <button onClick={() => onSwitch(assignment.id)}
                    disabled={switchLoading}
                    className="text-[10px] text-[#f96400] hover:underline disabled:opacity-50 ml-1">
                    Switch?
                  </button>
                )}
                <button onClick={() => onAssign(event.id, null)}
                  className="text-[10px] text-gray-300 hover:text-gray-500 ml-1">
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function FamilyCalendarGrid({ date, myProfileId }: { date: string; myProfileId: string }) {
  const [myEvents, setMyEvents] = useState<CalEvent[]>([])
  const [spouseEvents, setSpouseEvents] = useState<MemberEvent[]>([])
  const [kidEvents, setKidEvents] = useState<CalEvent[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [spouseProfile, setSpouseProfile] = useState<Profile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [switchLoading, setSwitchLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

      const [evRes, memberRes, assignRes, notifRes] = await Promise.all([
        fetch(`/api/user/events?date=${date}&tz=${encodeURIComponent(tz)}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`/api/family/member-events?date=${date}`).then(r => r.json()).catch(() => ({ memberEvents: [] })),
        myProfileId !== 'loading' ? fetch(`/api/coordination/assign?date=${date}`).then(r => r.json()).catch(() => ({ assignments: [] })) : Promise.resolve({ assignments: [] }),
        myProfileId !== 'loading' ? fetch('/api/notifications').then(r => r.json()).catch(() => ({ notifications: [] })) : Promise.resolve({ notifications: [] }),
      ])

      const allEvents: CalEvent[] = (evRes.events ?? []).map((e: any) => ({
        id: e.id, title: e.title, start: e.start, end: e.end,
        isAllDay: e.isAllDay, calendarName: e.calendarName, calendarColor: e.calendarColor,
        source: e.source,
        isKid: e.calendarName?.toLowerCase().includes('kid') ||
               e.calendarName?.toLowerCase().includes('hunter') ||
               e.calendarName?.toLowerCase().includes('hayden') ||
               e.calendarName?.toLowerCase().includes('baseball') ||
               e.calendarName?.toLowerCase().includes('soccer') ||
               e.calendarName?.toLowerCase().includes('activit'),
      }))

      setMyEvents(allEvents.filter(e => !e.isKid))
      setKidEvents(allEvents.filter(e => e.isKid))
      setSpouseEvents(memberRes.memberEvents ?? [])
      setAssignments(assignRes.assignments ?? [])
      setNotifications(notifRes.notifications ?? [])

      // Extract spouse profile from member events
      const memberEvts: MemberEvent[] = memberRes.memberEvents ?? []
      if (memberEvts.length > 0) {
        const first = memberEvts[0]
        setSpouseProfile({ id: first.memberId, name: first.memberName, color: first.memberColor })
      }

      } catch (e) {
        console.error('[FamilyCalendarGrid] load error', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [date])

  const assignEvent = async (eventId: string, profileId: string | null) => {
    await fetch('/api/coordination/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, assigned_to_profile_id: profileId }),
    })
    const res = await fetch(`/api/coordination/assign?date=${date}`)
    const data = await res.json()
    setAssignments(data.assignments ?? [])
  }

  const requestSwitch = async (assignmentId: string) => {
    setSwitchLoading(assignmentId)
    await fetch('/api/coordination/switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId }),
    })
    setSwitchLoading(null)
  }

  const getAssignment = (eventId: string) => assignments.find(a => a.event_id === eventId) ?? null

  // Merge my events + kid events sorted by time
  const allMyTimedEvents = [...myEvents.filter(e => !e.isAllDay), ...kidEvents]
    .sort((a, b) => a.start.localeCompare(b.start))

  const allTimedSpouseEvents = spouseEvents.filter(e => !e.isAllDay)

  // Deduplicate Liwei's events: hide if same title+approx time already in my column
  const myEventKeys = new Set(allMyTimedEvents.map(e => `${e.title.toLowerCase().trim()}::${e.start.slice(0,16)}`))
  const deduplicatedSpouseEvents = allTimedSpouseEvents.filter(se => {
    const key = `${(se.title ?? '').toLowerCase().trim()}::${se.start.slice(0,16)}`
    return !myEventKeys.has(key)
  })

  const unassignedKidEvents = kidEvents.filter(e => !getAssignment(e.id))
  const assignedKidEvents = kidEvents.filter(e => !!getAssignment(e.id))

  if (loading) {
    return <div className="text-center text-gray-400 py-8 text-sm">Loading calendars…</div>
  }

  return (
    <div>
      {/* Notifications banner */}
      {notifications.length > 0 && (
        <div className="mb-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-orange-700 mb-1">🔔 {notifications.length} pending</p>
          {notifications.slice(0, 2).map(n => (
            <div key={n.id} className="flex items-start justify-between gap-2 text-xs text-orange-800">
              <span>{n.title}</span>
              {n.type === 'switch_request' && n.reference_id && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={async () => {
                    await fetch('/api/coordination/switch/respond', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: n.reference_id, action:'accept'}) })
                    setNotifications(prev => prev.filter(x => x.id !== n.id))
                    const res = await fetch(`/api/coordination/assign?date=${date}`)
                    setAssignments((await res.json()).assignments ?? [])
                  }} className="bg-green-500 text-white px-2 py-0.5 rounded font-semibold">Accept</button>
                  <button onClick={async () => {
                    await fetch('/api/coordination/switch/respond', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: n.reference_id, action:'decline'}) })
                    setNotifications(prev => prev.filter(x => x.id !== n.id))
                  }} className="bg-red-400 text-white px-2 py-0.5 rounded font-semibold">Decline</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Two-column header */}
      {spouseProfile && (
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-[#f96400]">R</div>
            <span className="text-xs font-semibold text-gray-600">My calendar</span>
          </div>
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: spouseProfile.color }}>
              {initials(spouseProfile.name)}
            </div>
            <span className="text-xs font-semibold text-gray-600">{spouseProfile.name.split(' ')[0]}</span>
          </div>
        </div>
      )}

      {/* Timeline — interleaved adult + kid events sorted by time */}
      {spouseProfile ? (
        <div className="mb-3 space-y-1.5">
          {(() => {
            // Build a merged timeline with row types: 'pair' (adult) or 'kid-full' or 'kid-assigned'
            type Row =
              | { type: 'pair'; myEv: CalEvent | null; spouseEv: MemberEvent | null }
              | { type: 'kid-full'; ev: CalEvent }
              | { type: 'kid-assigned'; ev: CalEvent; assignment: Assignment }

            // Build all events with numeric timestamps for correct sort
            const myAdult = myEvents.filter(e => !e.isAllDay)
            const spouseTimedDeduped = deduplicatedSpouseEvents

            // Collect all unique ISO start times, sorted by actual Date value (not string)
            const allStarts = [
              ...myAdult.map(e => e.start),
              ...spouseTimedDeduped.map(e => e.start),
              ...kidEvents.map(e => e.start),
            ]
            const uniqueMs = Array.from(new Set(allStarts.map(s => new Date(s).getTime())))
            uniqueMs.sort((a, b) => a - b)

            const rows: Row[] = []
            for (const ms of uniqueMs) {
              // Match events within a 1-minute window of this timestamp
              const myEv = myAdult.find(e => Math.abs(new Date(e.start).getTime() - ms) < 60000) ?? null
              const spouseEv = spouseTimedDeduped.find(e => Math.abs(new Date(e.start).getTime() - ms) < 60000) ?? null
              const kidsAtTime = kidEvents.filter(e => Math.abs(new Date(e.start).getTime() - ms) < 60000)

              if (myEv || spouseEv) rows.push({ type: 'pair', myEv, spouseEv })

              for (const kev of kidsAtTime) {
                const assignment = getAssignment(kev.id)
                if (!assignment) {
                  rows.push({ type: 'kid-full', ev: kev })
                } else {
                  rows.push({ type: 'kid-assigned', ev: kev, assignment })
                }
              }
            }

            return rows.map((row, i) => {
              if (row.type === 'pair') {
                return (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <div>
                      {row.myEv ? (
                        <EventPill event={row.myEv} color={row.myEv.calendarColor ?? '#f96400'} myProfileId={myProfileId} />
                      ) : <div />}
                    </div>
                    <div>
                      {row.spouseEv ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: spouseProfile.color }} />
                            <p className="text-sm font-semibold text-gray-700 truncate">{row.spouseEv.title ?? 'Busy'}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{formatTime(row.spouseEv.start)}</p>
                        </div>
                      ) : <div />}
                    </div>
                  </div>
                )
              }

              if (row.type === 'kid-full') {
                // Unassigned — full width spanning both columns
                return (
                  <div key={i} className="rounded-xl border-2 border-orange-200 bg-orange-50 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">🧒</span>
                          <p className="text-sm font-bold text-gray-900 leading-tight">{row.ev.title}</p>
                        </div>
                        <p className="text-xs text-[#f96400] font-medium">{formatTime(row.ev.start)}</p>
                        <p className="text-[10px] text-orange-500 mt-0.5">Who's on duty?</p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end flex-shrink-0 mt-0.5">
                        <button onClick={() => assignEvent(row.ev.id, myProfileId)}
                          className="text-[11px] font-semibold bg-[#f96400] text-white px-2.5 py-1 rounded-lg">Me</button>
                        <button onClick={() => assignEvent(row.ev.id, spouseProfile.id)}
                          className="text-[11px] font-semibold bg-white text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg">
                          {spouseProfile.name.split(' ')[0]}
                        </button>
                        <button onClick={() => assignEvent(row.ev.id, 'both')}
                          className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">Both</button>
                        <button onClick={() => assignEvent(row.ev.id, 'none')}
                          className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">No need</button>
                      </div>
                    </div>
                  </div>
                )
              }

              // Assigned kid event
              const a = row.assignment
              const isMe = a.assigned_to === myProfileId
              const isSpouse = a.assigned_to === spouseProfile.id
              const isBoth = a.assigned_to === 'both'
              const isNone = a.assigned_to === 'none'

              return (
                <div key={i} className={`grid gap-2 ${isBoth ? '' : 'grid-cols-2'}`}>
                  {isBoth ? (
                    // Both — full width
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🧒</span>
                            <p className="text-sm font-semibold text-gray-900">{row.ev.title}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{formatTime(row.ev.start)} · Both parents</p>
                        </div>
                        <button onClick={() => assignEvent(row.ev.id, null)} className="text-[10px] text-gray-300 hover:text-gray-500">✕</button>
                      </div>
                    </div>
                  ) : isNone ? (
                    // No need — muted full width
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🧒</span>
                            <p className="text-sm text-gray-500">{row.ev.title}</p>
                          </div>
                          <p className="text-xs text-gray-300 mt-0.5">{formatTime(row.ev.start)} · No parent needed</p>
                        </div>
                        <button onClick={() => assignEvent(row.ev.id, null)} className="text-[10px] text-gray-300 hover:text-gray-500">✕</button>
                      </div>
                    </div>
                  ) : (
                    // Assigned to one parent — in their column
                    <>
                      <div>
                        {isMe ? (
                          <div className="rounded-xl border border-[#f96400] bg-orange-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm">🧒</span>
                                  <p className="text-sm font-semibold text-gray-900 truncate">{row.ev.title}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{formatTime(row.ev.start)}</p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {a && <button onClick={() => requestSwitch(a.id)} disabled={switchLoading === a.id} className="text-[10px] text-[#f96400] hover:underline disabled:opacity-50">Switch?</button>}
                                <button onClick={() => assignEvent(row.ev.id, null)} className="text-[10px] text-gray-300 hover:text-gray-500">✕</button>
                              </div>
                            </div>
                          </div>
                        ) : <div />}
                      </div>
                      <div>
                        {isSpouse ? (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm">🧒</span>
                                  <p className="text-sm font-semibold text-gray-700 truncate">{row.ev.title}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{formatTime(row.ev.start)}</p>
                              </div>
                              <button onClick={() => assignEvent(row.ev.id, null)} className="text-[10px] text-gray-300 hover:text-gray-500 flex-shrink-0">✕</button>
                            </div>
                          </div>
                        ) : <div />}
                      </div>
                    </>
                  )}
                </div>
              )
            })
          })()}
        </div>
      ) : (
        /* Single column when no spouse connected */
        <div className="mb-3 space-y-1.5">
          {allMyTimedEvents.map(ev => (
            <EventPill key={ev.id} event={ev}
              color={ev.isKid ? (ev.calendarColor ?? '#6366f1') : (ev.calendarColor ?? '#f96400')}
              onAssign={ev.isKid ? assignEvent : undefined}
              assignment={ev.isKid ? getAssignment(ev.id) : null}
              myProfileId={myProfileId} spouseProfile={null}
            />
          ))}
        </div>
      )}

      {/* All-day events */}
      {myEvents.filter(e => e.isAllDay).length > 0 && (
        <div className="border-t border-gray-100 pt-2 mt-1">
          <p className="text-[10px] text-gray-400 mb-1">All day</p>
          {myEvents.filter(e => e.isAllDay).map(ev => (
            <div key={ev.id} className="rounded-lg px-3 py-1.5 mb-1" style={{ backgroundColor: (ev.calendarColor ?? '#f96400') + '18', borderLeft: `3px solid ${ev.calendarColor ?? '#f96400'}` }}>
              <span className="text-sm font-medium text-gray-800">{ev.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
