'use client'

import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
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
}
type MemberEvent = {
  memberId: string; memberName: string; memberColor: string
  start: string; end: string; isAllDay: boolean; title?: string
}
type Profile = { id: string; name: string; color: string }
type Assignment = {
  id: string; event_id: string; assigned_to: string; status: string
}
type Notification = {
  id: string; type: string; title: string; body?: string
  action_url?: string; reference_id?: string
}

// ── Grid config ──────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64        // px per hour
const START_HOUR = 7          // 7am
const END_HOUR = 22           // 10pm
const TOTAL_HOURS = END_HOUR - START_HOUR
const TIME_LABEL_W = 44       // px for time labels on left
const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDeviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'America/New_York' }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: getDeviceTz(),
  })
}

function toMinutesFromMidnight(iso: string): number {
  const tz = getDeviceTz()
  const d = new Date(iso)
  // Get local hour/minute in device timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

function topPx(iso: string): number {
  const mins = toMinutesFromMidnight(iso)
  const offsetMins = mins - START_HOUR * 60
  return Math.max(0, (offsetMins / 60) * HOUR_HEIGHT)
}

function heightPx(startIso: string, endIso: string): number {
  const startMins = toMinutesFromMidnight(startIso)
  const endMins = toMinutesFromMidnight(endIso)
  const durationMins = Math.max(15, endMins - startMins)
  return (durationMins / 60) * HOUR_HEIGHT
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function overlaps(a: {start:string;end:string}, b: {start:string;end:string}) {
  return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end)
}

// ── Event block ──────────────────────────────────────────────────────────────
function EventBlock({
  title, startIso, endIso, color, isKid, assignment, myProfileId, spouseName,
  spouseId, spouseColor, onAssign, onSwitch, switchLoading, stackOffset = 0,
}: {
  title: string; startIso: string; endIso: string; color: string
  isKid?: boolean; assignment?: Assignment | null
  myProfileId: string; spouseName?: string; spouseId?: string; spouseColor?: string
  onAssign?: (id: string, to: string | null) => void
  onSwitch?: (id: string) => void; switchLoading?: boolean; stackOffset?: number
}) {
  const top = topPx(startIso)
  const h = heightPx(startIso, endIso)
  const isShort = h < 36
  const assignedTo = assignment?.assigned_to

  const bg = isKid && !assignment
    ? 'bg-orange-50 border-2 border-orange-300'
    : `border`

  return (
    <div
      className={`absolute left-0 right-0 rounded-lg overflow-hidden ${bg}`}
      style={{
        top: top + stackOffset * 3,
        height: Math.max(h - stackOffset * 3, 20),
        backgroundColor: assignment ? undefined : (isKid ? undefined : color + '22'),
        borderColor: color,
        zIndex: 10 + stackOffset,
        marginLeft: stackOffset * 4,
        marginRight: stackOffset * 4,
      }}
    >
      <div className="h-full flex flex-col justify-between p-1.5 overflow-hidden">
        <div className="flex items-start gap-1 min-w-0">
          {isKid && <span className="text-xs flex-shrink-0">🧒</span>}
          <div className="min-w-0 flex-1">
            <p className={`font-semibold leading-tight text-gray-900 ${isShort ? 'text-[10px]' : 'text-xs'}`}
              style={{ wordBreak: 'break-word' }}>
              {title}
            </p>
            {!isShort && (
              <p className="text-[10px] text-gray-500 mt-0.5">{fmtTime(startIso)}</p>
            )}
          </div>
        </div>

        {/* Kid assignment buttons */}
        {isKid && onAssign && !isShort && (
          <div className="mt-1">
            {!assignedTo ? (
              <div className="flex flex-wrap gap-0.5">
                <button onClick={() => onAssign(assignment?.id ?? '', myProfileId)}
                  className="text-[9px] font-bold bg-[#f96400] text-white px-1.5 py-0.5 rounded">Me</button>
                {spouseId && (
                  <button onClick={() => onAssign(assignment?.id ?? '', spouseId)}
                    className="text-[9px] font-bold bg-white text-gray-700 border border-gray-300 px-1.5 py-0.5 rounded">
                    {spouseName?.split(' ')[0]}
                  </button>
                )}
                <button onClick={() => onAssign(assignment?.id ?? '', 'both')}
                  className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Both</button>
                <button onClick={() => onAssign(assignment?.id ?? '', 'none')}
                  className="text-[9px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">None</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-semibold text-gray-600">
                  {assignedTo === 'both' ? '✓ Both' : assignedTo === 'none' ? '✓ None' :
                   assignedTo === myProfileId ? '✓ Me' : `✓ ${spouseName?.split(' ')[0]}`}
                </span>
                {onSwitch && assignment && assignedTo !== 'both' && assignedTo !== 'none' && (
                  <button onClick={() => onSwitch(assignment.id)}
                    disabled={switchLoading}
                    className="text-[9px] text-[#f96400] hover:underline disabled:opacity-50">Switch?</button>
                )}
                <button onClick={() => onAssign(assignment?.id ?? '', null)}
                  className="text-[9px] text-gray-300 hover:text-gray-500 ml-1">✕</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Column ───────────────────────────────────────────────────────────────────
function CalColumn({ events, color, isSpouse, myProfileId, spouseProfile, assignments, onAssign, onSwitch, switchLoading, kidEvents }: {
  events: Array<{id?:string; title: string; start: string; end: string; isAllDay?: boolean; calendarColor?: string; isKid?: boolean}>
  color: string; isSpouse?: boolean; myProfileId: string
  spouseProfile?: Profile | null
  assignments: Assignment[]
  onAssign: (eventId: string, to: string | null) => void
  onSwitch: (assignmentId: string) => void
  switchLoading: string | null
  kidEvents?: CalEvent[]
}) {
  return (
    <div className="relative flex-1" style={{ height: GRID_HEIGHT }}>
      {events.map((ev, i) => {
        if (ev.isAllDay) return null
        // Check for stacking — find other events that overlap this one
        const overlapping = events.filter((other, j) => j < i && !other.isAllDay && overlaps(ev, other))
        const stackOffset = overlapping.length
        const assignment = ev.id ? assignments.find(a => a.event_id === ev.id) ?? null : null

        return (
          <EventBlock
            key={ev.id ?? i}
            title={ev.title}
            startIso={ev.start}
            endIso={ev.end}
            color={ev.calendarColor ?? color}
            isKid={ev.isKid}
            assignment={assignment}
            myProfileId={myProfileId}
            spouseName={spouseProfile?.name}
            spouseId={spouseProfile?.id}
            spouseColor={spouseProfile?.color}
            onAssign={ev.id ? (_, to) => onAssign(ev.id!, to) : undefined}
            onSwitch={onSwitch}
            switchLoading={switchLoading === assignment?.id}
            stackOffset={stackOffset}
          />
        )
      })}
    </div>
  )
}

// ── Full-width kid event (unassigned) ────────────────────────────────────────
function KidFullWidth({ ev, myProfileId, spouseProfile, onAssign }: {
  ev: CalEvent; myProfileId: string; spouseProfile?: Profile | null
  onAssign: (eventId: string, to: string | null) => void
}) {
  const top = topPx(ev.start)
  const h = Math.max(heightPx(ev.start, ev.end), 52)

  return (
    <div className="absolute left-0 right-0 rounded-xl border-2 border-orange-300 bg-orange-50 overflow-hidden z-20 px-2 py-1.5"
      style={{ top, height: h }}>
      <div className="flex items-start justify-between gap-1 h-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs">🧒</span>
            <p className="text-xs font-bold text-gray-900 leading-tight" style={{ wordBreak: 'break-word' }}>{ev.title}</p>
          </div>
          <p className="text-[10px] text-[#f96400] font-medium mt-0.5">{fmtTime(ev.start)}</p>
        </div>
        <div className="flex flex-wrap gap-0.5 justify-end flex-shrink-0">
          <button onClick={() => onAssign(ev.id, myProfileId)}
            className="text-[9px] font-bold bg-[#f96400] text-white px-1.5 py-0.5 rounded">Me</button>
          {spouseProfile && (
            <button onClick={() => onAssign(ev.id, spouseProfile.id)}
              className="text-[9px] font-bold bg-white text-gray-700 border border-gray-300 px-1.5 py-0.5 rounded">
              {spouseProfile.name.split(' ')[0]}
            </button>
          )}
          <button onClick={() => onAssign(ev.id, 'both')}
            className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Both</button>
          <button onClick={() => onAssign(ev.id, 'none')}
            className="text-[9px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">None</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function FamilyCalendarGrid({ date, myProfileId }: { date: string; myProfileId: string }) {
  const [myEvents, setMyEvents] = useState<CalEvent[]>([])
  const [spouseEvents, setSpouseEvents] = useState<MemberEvent[]>([])
  const [kidEvents, setKidEvents] = useState<CalEvent[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [spouseProfile, setSpouseProfile] = useState<Profile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [switchLoading, setSwitchLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAssignments = async () => {
    const res = await fetch(`/api/coordination/assign?date=${date}`)
    const data = await res.json()
    setAssignments(data.assignments ?? [])
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const tz = getDeviceTz()
        const [evRes, memberRes, assignRes, notifRes] = await Promise.all([
          fetch(`/api/user/events?date=${date}&tz=${encodeURIComponent(tz)}`).then(r => r.json()).catch(() => ({ events: [] })),
          fetch(`/api/family/member-events?date=${date}`).then(r => r.json()).catch(() => ({ memberEvents: [] })),
          myProfileId !== 'loading' ? fetch(`/api/coordination/assign?date=${date}`).then(r => r.json()).catch(() => ({ assignments: [] })) : Promise.resolve({ assignments: [] }),
          myProfileId !== 'loading' ? fetch('/api/notifications').then(r => r.json()).catch(() => ({ notifications: [] })) : Promise.resolve({ notifications: [] }),
        ])

        const allEvents: CalEvent[] = (evRes.events ?? []).map((e: any) => {
          const name = (e.calendarName ?? '').toLowerCase()
          const isKid = name.includes('kid') || name.includes('hunter') ||
            name.includes('hayden') || name.includes('baseball') ||
            name.includes('soccer') || name.includes('activit') || name.includes('4v4')
          return { id: e.id, title: e.title, start: e.start, end: e.end, isAllDay: e.isAllDay, calendarName: e.calendarName, calendarColor: e.calendarColor, source: e.source, isKid }
        })

        // Dedup spouse events
        const myKeys = new Set(allEvents.map(e => `${e.title.toLowerCase().trim()}::${e.start.slice(0,16)}`))
        const memberEvts: MemberEvent[] = (memberRes.memberEvents ?? []).filter((me: MemberEvent) => {
          if (me.isAllDay) return false
          return !myKeys.has(`${(me.title ?? '').toLowerCase().trim()}::${me.start.slice(0,16)}`)
        })

        setMyEvents(allEvents.filter(e => !e.isKid))
        setKidEvents(allEvents.filter(e => e.isKid))
        setSpouseEvents(memberEvts)
        setAssignments(assignRes.assignments ?? [])
        setNotifications(notifRes.notifications ?? [])

        if (memberEvts.length > 0) {
          const first = memberEvts[0]
          setSpouseProfile({ id: first.memberId, name: first.memberName, color: first.memberColor })
        }
      } catch (e) {
        console.error('[FamilyCalendarGrid]', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [date, myProfileId])

  const assignEvent = async (eventId: string, profileId: string | null) => {
    await fetch('/api/coordination/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, assigned_to_profile_id: profileId }),
    })
    await loadAssignments()
  }

  const requestSwitch = async (assignmentId: string) => {
    setSwitchLoading(assignmentId)
    await fetch('/api/coordination/switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId }),
    })
    setSwitchLoading(null)
  }

  const unassignedKids = kidEvents.filter(e => !assignments.find(a => a.event_id === e.id))
  const assignedKids = kidEvents.filter(e => !!assignments.find(a => a.event_id === e.id))

  // Kid events assigned to me or both → show in my column
  const myKidsInCol = assignedKids.filter(e => {
    const a = assignments.find(x => x.event_id === e.id)
    return a && (a.assigned_to === myProfileId || a.assigned_to === 'both' || a.assigned_to === 'none')
  })
  // Kids assigned to spouse → show in spouse column
  const spouseKidsInCol = spouseProfile ? assignedKids.filter(e => {
    const a = assignments.find(x => x.event_id === e.id)
    return a && (a.assigned_to === spouseProfile.id)
  }) : []

  const myColEvents = [
    ...myEvents.filter(e => !e.isAllDay),
    ...myKidsInCol.map(e => ({ ...e })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  const spouseColEvents = [
    ...spouseEvents,
    ...spouseKidsInCol.map(e => ({ ...e })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  if (loading) {
    return <div className="text-center text-gray-400 py-8 text-sm">Loading calendars…</div>
  }

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i)

  return (
    <div>
      {/* Notification banner */}
      {notifications.length > 0 && (
        <div className="mb-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2">
          <p className="text-xs font-semibold text-orange-700 mb-1">🔔 {notifications.length} pending action{notifications.length !== 1 ? 's' : ''}</p>
          {notifications.slice(0, 2).map(n => (
            <div key={n.id} className="flex items-center justify-between gap-2 text-xs text-orange-800 py-0.5">
              <span>{n.title}</span>
              {n.type === 'switch_request' && n.reference_id && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={async () => {
                    await fetch('/api/coordination/switch/respond', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: n.reference_id, action:'accept'}) })
                    setNotifications(prev => prev.filter(x => x.id !== n.id))
                    await loadAssignments()
                  }} className="bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">Accept</button>
                  <button onClick={async () => {
                    await fetch('/api/coordination/switch/respond', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: n.reference_id, action:'decline'}) })
                    setNotifications(prev => prev.filter(x => x.id !== n.id))
                  }} className="bg-red-400 text-white px-2 py-0.5 rounded text-[10px] font-bold">Decline</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Column headers */}
      <div className="flex mb-1" style={{ paddingLeft: TIME_LABEL_W }}>
        <div className="flex-1 flex items-center gap-1.5 px-1">
          <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-[#f96400]">R</div>
          <span className="text-xs font-semibold text-gray-600">Me</span>
        </div>
        {spouseProfile && (
          <div className="flex-1 flex items-center gap-1.5 px-1">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: spouseProfile.color }}>
              {initials(spouseProfile.name)}
            </div>
            <span className="text-xs font-semibold text-gray-600">{spouseProfile.name.split(' ')[0]}</span>
          </div>
        )}
      </div>

      {/* Time grid */}
      <div className="flex" style={{ height: GRID_HEIGHT }}>
        {/* Time labels */}
        <div className="flex-shrink-0" style={{ width: TIME_LABEL_W }}>
          {hours.map(h => (
            <div key={h} className="flex items-start justify-end pr-2"
              style={{ height: h === END_HOUR ? 0 : HOUR_HEIGHT }}>
              <span className="text-[10px] text-gray-400 -translate-y-2">
                {h === 12 ? '12pm' : h > 12 ? `${h-12}pm` : `${h}am`}
              </span>
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div className="flex-1 relative flex gap-1">
          {/* Horizontal hour lines */}
          {hours.map(h => (
            <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT, zIndex: 1 }} />
          ))}

          {/* My column */}
          <div className="relative flex-1">
            <CalColumn
              events={myColEvents}
              color="#f96400"
              myProfileId={myProfileId}
              spouseProfile={spouseProfile}
              assignments={assignments}
              onAssign={assignEvent}
              onSwitch={requestSwitch}
              switchLoading={switchLoading}
            />
          </div>

          {/* Spouse column */}
          {spouseProfile && (
            <div className="relative flex-1">
              <CalColumn
                events={spouseColEvents as any}
                color={spouseProfile.color}
                isSpouse
                myProfileId={myProfileId}
                spouseProfile={spouseProfile}
                assignments={assignments}
                onAssign={assignEvent}
                onSwitch={requestSwitch}
                switchLoading={switchLoading}
              />
            </div>
          )}

          {/* Unassigned kids — full width overlay */}
          {unassignedKids.map(ev => (
            <KidFullWidth
              key={ev.id}
              ev={ev}
              myProfileId={myProfileId}
              spouseProfile={spouseProfile}
              onAssign={assignEvent}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
