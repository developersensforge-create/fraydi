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

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
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

      {/* Two-column timed events — kids merged inline by time */}
      {spouseProfile ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* My column: my events + all kid events (assigned or unassigned) sorted by time */}
          <div>
            {allMyTimedEvents.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">Nothing today</p>
            ) : allMyTimedEvents.map(ev => {
              const assignment = ev.isKid ? getAssignment(ev.id) : null
              const assignedTo = assignment?.assigned_to
              // Kid assigned to spouse only → show in spouse col, not here
              if (ev.isKid && assignedTo && assignedTo !== myProfileId && assignedTo !== 'both' && assignedTo !== 'none') return null
              return (
                <EventPill key={ev.id}
                  event={ev}
                  color={ev.isKid ? (ev.calendarColor ?? '#6366f1') : (ev.calendarColor ?? '#f96400')}
                  onAssign={ev.isKid ? assignEvent : undefined}
                  assignment={ev.isKid ? assignment : null}
                  myProfileId={myProfileId}
                  spouseProfile={spouseProfile}
                  switchLoading={switchLoading === assignment?.id}
                  onSwitch={ev.isKid ? requestSwitch : undefined}
                />
              )
            })}
          </div>
          {/* Spouse column: deduplicated, plus kids assigned to spouse */}
          <div>
            {deduplicatedSpouseEvents.length === 0 && assignedKidEvents.filter(e => getAssignment(e.id)?.assigned_to === spouseProfile.id).length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">Nothing today</p>
            ) : null}
            {deduplicatedSpouseEvents.map((ev, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: spouseProfile.color }} />
                  <p className="text-sm font-semibold text-gray-700 truncate">{ev.title ?? 'Busy'}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{formatTime(ev.start)}</p>
              </div>
            ))}
            {/* Kids assigned to spouse */}
            {assignedKidEvents.filter(e => getAssignment(e.id)?.assigned_to === spouseProfile.id).map(ev => (
              <EventPill key={ev.id} event={ev} color={ev.calendarColor ?? '#6366f1'}
                onAssign={assignEvent} assignment={getAssignment(ev.id)}
                myProfileId={myProfileId} spouseProfile={spouseProfile}
                switchLoading={switchLoading === getAssignment(ev.id)?.id}
                onSwitch={requestSwitch} />
            ))}
          </div>
        </div>
      ) : (
        /* Single column when no spouse connected */
        <div className="mb-3">
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
