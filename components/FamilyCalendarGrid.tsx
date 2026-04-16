'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
const END_HOUR = 24           // midnight
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
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return (h === 24 ? 0 : h) * 60 + m
}

function topPx(iso: string): number {
  const mins = toMinutesFromMidnight(iso)
  const offsetMins = mins - START_HOUR * 60
  return Math.max(0, (offsetMins / 60) * HOUR_HEIGHT)
}

function heightPx(startIso: string, endIso: string): number {
  const startMins = toMinutesFromMidnight(startIso)
  let endMins = toMinutesFromMidnight(endIso)
  // Handle midnight-crossing events: end < start means end is next day
  if (endMins <= startMins) endMins += 24 * 60
  const durationMins = Math.max(30, endMins - startMins) // min 30min for readability
  return (durationMins / 60) * HOUR_HEIGHT
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function overlaps(a: {start:string;end:string}, b: {start:string;end:string}) {
  return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end)
}

// ── Reminder tags (inline add on event) ──────────────────────────────────────
function ReminderTags({ eventId, color, reminders: initialReminders }: {
  eventId: string; color: string
  reminders: Array<{id: string; label: string; done: boolean}>
}) {
  const [reminders, setReminders] = useState(initialReminders)
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setReminders(initialReminders) }, [initialReminders])
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const addReminder = async () => {
    if (!input.trim()) { setAdding(false); return }
    const label = input.trim()
    setInput('')
    setAdding(false)
    // Optimistic
    const tempId = 'temp-' + Date.now()
    setReminders(prev => [...prev, { id: tempId, label, done: false }])
    const res = await fetch('/api/event-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, label }),
    }).then(r => r.json()).catch(() => null)
    if (res?.reminder) {
      setReminders(prev => prev.map(r => r.id === tempId ? { ...r, id: res.reminder.id } : r))
    }
  }

  const toggleDone = async (id: string, done: boolean) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, done } : r))
    await fetch('/api/event-reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, done }),
    })
  }

  return (
    <div className="mt-1" onClick={e => e.stopPropagation()}>
      {reminders.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-0.5">
          {reminders.map(r => (
            <button key={r.id}
              onClick={() => toggleDone(r.id, !r.done)}
              className="text-[9px] px-1 py-0.5 rounded font-medium flex items-center gap-0.5 transition-opacity"
              style={{ backgroundColor: color + '25', color, opacity: r.done ? 0.5 : 1 }}>
              {r.done ? '✓' : '📦'} {r.label}
            </button>
          ))}
        </div>
      )}
      {adding ? (
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addReminder(); if (e.key === 'Escape') { setAdding(false); setInput('') } }}
          onBlur={addReminder}
          placeholder="e.g. Baseball bag"
          className="text-[9px] w-full border-b px-0.5 focus:outline-none bg-transparent"
          style={{ borderColor: color, color: '#374151' }}
        />
      ) : (
        // Only show "+ reminder" on hover — never takes layout space by default
        <button
          onClick={() => setAdding(true)}
          className="text-[9px] opacity-0 group-hover/event:opacity-50 hover:!opacity-100 transition-opacity h-0 group-hover/event:h-auto overflow-hidden"
          style={{ color }}>
          + reminder
        </button>
      )}
    </div>
  )
}

// ── Event block ──────────────────────────────────────────────────────────────
function EventBlock({
  title, startIso, endIso, color, isKid, assignment, myProfileId, spouseName,
  spouseId, onAssign, onSwitch, switchLoading, eventId, reminders,
  stackIndex = 0, stackTotal = 1,
}: {
  title: string; startIso: string; endIso: string; color: string
  isKid?: boolean; assignment?: Assignment | null
  myProfileId: string; spouseName?: string; spouseId?: string
  onAssign?: (id: string, to: string | null) => void
  onSwitch?: (id: string) => void; switchLoading?: boolean
  eventId?: string
  reminders?: Array<{id: string; label: string; done: boolean}>
  stackIndex?: number; stackTotal?: number
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{top:number;right:number} | null>(null)
  const dropBtnRef = useRef<HTMLButtonElement>(null)
  const top = topPx(startIso)
  const h = heightPx(startIso, endIso)
  const isShort = h < 40
  const assignedTo = assignment?.assigned_to

  // Position is now controlled by CalColumn — EventBlock fills its container
  const leftPct = 0
  const rightPct = 0

  const status = assignment?.status

  const dutyLabel = !assignedTo ? null :
    assignedTo === 'both' ? 'Both drive' :
    assignedTo === 'none' ? 'No driver needed' :
    assignedTo === myProfileId ? 'I drive' :
    `${spouseName?.split(' ')[0]} drives`

  // Visual states per spec
  const isSkipped = assignedTo === 'skip'
  const isNoDriver = assignedTo === 'none'
  const isSpousePending = !!assignedTo && assignedTo !== myProfileId && assignedTo !== 'both' && assignedTo !== 'none' && assignedTo !== 'skip' && status === 'pending'
  const isSolid = !!assignedTo && (assignedTo === myProfileId || assignedTo === 'both' || status === 'confirmed')

  // Skip hides the event entirely
  if (isSkipped) return null

  // Left-bar hollow box style (Outlook/Google Calendar style)
  // Hollow = white/very light bg, colored left bar, thin border
  const barColor = color
  const bgColor = isNoDriver ? '#fafafa' : '#ffffff'
  const boxOpacity = isNoDriver ? 0.6 : 1
  const borderColor = isNoDriver ? color + '40' : color + '30'
  const barStyle = isNoDriver
    ? `2px dashed ${color}80`   // dashed bar for no-driver
    : isSpousePending
      ? `3px dashed ${color}`   // dashed bar for pending
      : `4px solid ${barColor}` // solid bar default

  return (
    <div
      className="rounded-r-lg overflow-hidden flex group/event w-full h-full"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: 'none',
        opacity: boxOpacity,
      }}
    >
      {/* Left color bar */}
      <div className="flex-shrink-0 rounded-l-lg" style={{
        width: isNoDriver ? 3 : 4,
        background: barStyle.includes('dashed') ? 'transparent' : barColor,
        borderLeft: barStyle,
        marginLeft: -1,
      }} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ padding: isShort ? '1px 3px' : '5px 6px' }}>
        {/* Short event: single-row layout — time + title inline */}
        {isShort ? (
          // Short event: single line — time · title, absolutely fills the box
          <div className="flex items-center gap-1 w-full h-full overflow-hidden" style={{ minHeight: 0 }}>
            {isKid && <span className="text-[9px] flex-shrink-0 leading-none">🧒</span>}
            <span className="text-[9px] font-medium flex-shrink-0 whitespace-nowrap leading-none" style={{ color }}>{fmtTime(startIso)}</span>
            <span className="text-[9px] font-semibold text-gray-800 truncate flex-1 min-w-0 leading-none">{title}</span>
          </div>
        ) : (
        <>
        {/* Normal event: two-row layout */}
        {/* Top row: time + kid indicator + duty dropdown */}
        <div className="flex items-center justify-between gap-1 flex-shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            {isKid && <span className="text-[10px]">🧒</span>}
            <span className="text-[10px] font-medium" style={{ color }}>{fmtTime(startIso)}</span>
          </div>
          {/* Duty control */}
          {isKid && onAssign && (
            <div className="relative flex-shrink-0">
              {!assignedTo ? (
                <button
                  ref={dropBtnRef}
                  onClick={e => { e.stopPropagation(); const r = dropBtnRef.current?.getBoundingClientRect(); if(r) setDropdownPos({top: r.bottom+4, right: window.innerWidth-r.right}); setDropdownOpen(o => !o) }}
                  className="text-[9px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-0.5"
                >
                  Driver? ▾
                </button>
              ) : (
                <button
                  ref={dropBtnRef}
                  onClick={e => { e.stopPropagation(); const r = dropBtnRef.current?.getBoundingClientRect(); if(r) setDropdownPos({top: r.bottom+4, right: window.innerWidth-r.right}); setDropdownOpen(o => !o) }}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                  style={{ backgroundColor: color + '30', color }}
                >
                  {dutyLabel} ▾
                </button>
              )}
              {dropdownOpen && dropdownPos && typeof document !== 'undefined' && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setDropdownOpen(false)} />
                  <div className="fixed bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-[9999] min-w-[150px]"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                    onClick={e => e.stopPropagation()}>
                    {[
                      { val: myProfileId, label: '🚗 I drive' },
                      ...(spouseId ? [{ val: spouseId, label: `🚗 ${spouseName?.split(' ')[0]} drives` }] : []),
                      { val: 'both', label: '🚗 Both drive' },
                      { val: 'none', label: '📍 No driver needed' },
                      { val: null, label: '↩ Clear' },
                    ].map(opt => (
                      <button key={opt.val ?? 'clear'}
                        onClick={() => { onAssign!(assignment?.id ?? '', opt.val); setDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${assignedTo === opt.val ? 'font-bold text-[#f96400]' : 'text-gray-700'}`}
                      >
                        {opt.val === assignedTo && opt.val !== null ? `✓ ${opt.label}` : opt.label}
                      </button>
                    ))}
                    <button
                      onClick={() => { onAssign!(assignment?.id ?? '', 'skip'); setDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 border-t border-gray-100"
                    >
                      🚫 Skip this event
                    </button>
                  {assignedTo && assignedTo !== 'both' && assignedTo !== 'none' && onSwitch && assignment && (
                    <button onClick={() => { onSwitch(assignment.id); setDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-[#f96400] hover:bg-orange-50 border-t border-gray-100">
                      🔄 Request switch
                    </button>
                  )}
                  </div>
                </>,
                document.body
              )}
            </div>
          )}
        </div>

        {/* Title — flex-1 so it fills all remaining space; clamp prevents overflow */}
        <p className={`font-semibold text-gray-800 leading-tight flex-1 min-h-0 overflow-hidden ${h < 80 ? 'text-[10px]' : 'text-xs'}`}
          style={{ wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: h < 55 ? 1 : h < 100 ? 2 : 4, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
          {title}
        </p>
        {/* Reminder tags — only on tall events (>120px) so they never eat title space */}
        {h > 120 && !isShort && eventId && (
          <ReminderTags eventId={eventId} color={color} reminders={reminders ?? []} />
        )}
        </>
        )}
      </div>
    </div>
  )
}

// ── Column ───────────────────────────────────────────────────────────────────
// Overlap strategy: left-edge offset (Outlook/Teams style)
// - All events share the same right edge
// - Each overlap level shifts the left edge right by LEFT_OFFSET px
// - Color bar of every event remains visible (peeking out from under the front event)
// - Later start time → higher z-index (front layer)
// - Tap any event to bring it to full focus
const LEFT_OFFSET = 12 // px per overlap level — enough to show color bar, not so much it hides title

function CalColumn({ events, color, isSpouse, myProfileId, spouseProfile, assignments, onAssign, onSwitch, switchLoading, remindersMap }: {
  events: Array<{id?:string; title: string; start: string; end: string; isAllDay?: boolean; calendarColor?: string; isKid?: boolean}>
  color: string; isSpouse?: boolean; myProfileId: string
  spouseProfile?: Profile | null
  assignments: Assignment[]
  onAssign: (eventId: string, to: string | null) => void
  onSwitch: (assignmentId: string) => void
  switchLoading: string | null
  remindersMap?: Record<string, Array<{id:string;label:string;done:boolean}>>
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const timedEvents = events.filter(e => !e.isAllDay)

  // Build overlap clusters: group events that overlap with any member of the group
  const visited = new Set<number>()
  const clusters: typeof timedEvents[] = []
  for (let i = 0; i < timedEvents.length; i++) {
    if (visited.has(i)) continue
    const cluster: typeof timedEvents = [timedEvents[i]]
    visited.add(i)
    for (let j = i + 1; j < timedEvents.length; j++) {
      if (!visited.has(j) && cluster.some(c => overlaps(c, timedEvents[j]))) {
        cluster.push(timedEvents[j])
        visited.add(j)
      }
    }
    clusters.push(cluster)
  }

  return (
    <div className="relative flex-1" style={{ height: GRID_HEIGHT }}>
      {clusters.map(cluster =>
        cluster.map((ev, slotIndex) => {
          const assignment = ev.id ? assignments.find(a => a.event_id === ev.id) ?? null : null
          const isSkipped = assignment?.assigned_to === 'skip'
          if (isSkipped) return null

          const n = cluster.length
          const evKey = ev.id ?? ev.title
          const isFocused = focusedId === evKey
          const isUnfocused = focusedId !== null && !isFocused

          // Sort cluster by start time: earlier start = further back (lower z)
          const sortedCluster = [...cluster].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          const zRank = sortedCluster.indexOf(ev) // later start = higher z = front

          // Left-offset stacking: back events have leftPx=0, each subsequent level shifts right
          // Earlier start = further back (lower z, no left offset)
          // Later start = closer to front (higher z, more left offset so left bar still visible)
          const leftPx = zRank * LEFT_OFFSET

          // Opacity: front layer is slightly transparent when overlapping (always see through)
          // When focus active: focused = full, others = faded but still CLICKABLE
          const opacity = isUnfocused ? 0.45 : isFocused ? 1 : n > 1 && zRank === n - 1 ? 0.82 : 1

          return (
            <div
              key={evKey}
              style={{
                position: 'absolute',
                top: topPx(ev.start),
                height: Math.max(heightPx(ev.start, ev.end), 24),
                left: leftPx,
                right: 0,
                zIndex: isFocused ? 50 : 10 + zRank,
                opacity,
                transition: 'opacity 0.15s',
                // All events always receive pointer events — clicking any event focuses it
                pointerEvents: 'auto',
              }}
              onClick={e => { e.stopPropagation(); setFocusedId(prev => prev === evKey ? null : evKey) }}
            >
              <EventBlock
                title={ev.title}
                startIso={ev.start}
                endIso={ev.end}
                color={(ev as any).calendarColor ?? color}
                isKid={(ev as any).isKid}
                assignment={assignment}
                myProfileId={myProfileId}
                spouseName={spouseProfile?.name}
                spouseId={spouseProfile?.id}
                onAssign={ev.id ? (_, to) => onAssign(ev.id!, to) : undefined}
                onSwitch={onSwitch}
                switchLoading={switchLoading === assignment?.id}
                eventId={ev.id}
                reminders={ev.id ? remindersMap?.[ev.id] : undefined}
                stackIndex={0}
                stackTotal={1}
              />
            </div>
          )
        })
      )}
      {/* Tap column background to dismiss focus */}
      <div className="absolute inset-0 z-0" onClick={() => setFocusedId(null)} style={{ pointerEvents: focusedId ? 'auto' : 'none' }} />
    </div>
  )
}

// ── Full-width kid event — spans both columns (unassigned or 'none') ─────────
function KidFullWidth({ ev, myProfileId, spouseProfile, assignment, onAssign, stackOffset = 0 }: {
  ev: CalEvent; myProfileId: string; spouseProfile?: Profile | null
  assignment: Assignment | null
  onAssign: (eventId: string, to: string | null) => void
  stackOffset?: number
}) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState<{top:number;right:number} | null>(null)
  const dropBtnRef2 = useRef<HTMLButtonElement>(null)
  const top = topPx(ev.start)
  const h = Math.max(heightPx(ev.start, ev.end), 44)
  const isNoDriver = assignment?.assigned_to === 'none'
  const color = (ev as any).calendarColor ?? '#f96400'

  return (
    // Hollow box + left color bar — same style as EventBlock
    // stackOffset: left-shift for overlapping full-width kids
    <div className="absolute right-0 z-20 flex rounded-r-lg overflow-hidden"
      style={{
        top, height: h,
        left: stackOffset,
        backgroundColor: '#ffffff',
        border: `1px solid ${color}30`,
        borderLeft: 'none',
        opacity: isNoDriver ? 0.7 : 1,
      }}>
      {/* Left color bar */}
      <div className="flex-shrink-0" style={{
        width: 4,
        borderLeft: isNoDriver ? `3px dashed ${color}80` : `4px solid ${color}`,
      }} />
      <div className="flex-1 flex items-start justify-between gap-1 p-1.5 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px]">🧒</span>
            <span className="text-[10px] font-medium" style={{ color }}>{fmtTime(ev.start)}</span>
          </div>
          <p className="text-xs font-semibold text-gray-800 leading-tight mt-0.5 truncate">{ev.title}</p>
        </div>
        {/* Compact dropdown — portal so it's never clipped */}
        <div className="flex-shrink-0">
          <button
            ref={dropBtnRef2}
            onClick={e => {
              e.stopPropagation()
              const r = dropBtnRef2.current?.getBoundingClientRect()
              if (r) setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
              setOpen(o => !o)
            }}
            className="text-[9px] font-semibold px-2 py-1 rounded-lg border flex items-center gap-0.5"
            style={isNoDriver
              ? { backgroundColor: color+'20', color, borderColor: color+'60' }
              : { backgroundColor: '#fed7aa', color: '#c2410c', borderColor: '#fdba74' }
            }>
            {isNoDriver ? '📍 No driver ▾' : 'Driver? ▾'}
          </button>
          {open && dropPos && typeof document !== 'undefined' && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
              <div className="fixed bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-[9999] min-w-[150px]"
                style={{ top: dropPos.top, right: dropPos.right }}
                onClick={e => e.stopPropagation()}>
                {[
                  { val: myProfileId, label: '🚗 I drive' },
                  ...(spouseProfile ? [{ val: spouseProfile.id, label: `🚗 ${spouseProfile.name.split(' ')[0]} drives` }] : []),
                  { val: 'both', label: '🚗 Both drive' },
                  { val: 'none', label: '📍 No driver needed' },
                  { val: null, label: '↩ Clear' },
                ].map(opt => (
                  <button key={opt.val ?? 'clear'}
                    onClick={() => { onAssign(ev.id, opt.val); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${assignment?.assigned_to === opt.val && opt.val !== null ? 'font-bold text-[#f96400]' : 'text-gray-700'}`}>
                    {assignment?.assigned_to === opt.val && opt.val !== null ? `✓ ${opt.label}` : opt.label}
                  </button>
                ))}
                <button
                  onClick={() => { onAssign(ev.id, 'skip'); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 border-t border-gray-100">
                  🚫 Skip this event
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  )
}

// ── Current time helpers ─────────────────────────────────────────────────────
function getNowTopPx(): number | null {
  const tz = getDeviceTz()
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const hour = h === 24 ? 0 : h
  if (hour < START_HOUR || hour >= END_HOUR) return null
  const offsetMins = hour * 60 + m - START_HOUR * 60
  return (offsetMins / 60) * HOUR_HEIGHT
}

// ── Main component ───────────────────────────────────────────────────────────
export default function FamilyCalendarGrid({ date, myProfileId }: { date: string; myProfileId: string }) {
  const [myEvents, setMyEvents] = useState<CalEvent[]>([])
  const [spouseEvents, setSpouseEvents] = useState<MemberEvent[]>([])
  const [kidEvents, setKidEvents] = useState<CalEvent[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [remindersMap, setRemindersMap] = useState<Record<string, Array<{id:string;label:string;done:boolean}>>>({})
  const [spouseProfile, setSpouseProfile] = useState<Profile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [switchLoading, setSwitchLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowLinePx, setNowLinePx] = useState<number | null>(null)

  // Update current time marker every minute
  useEffect(() => {
    setNowLinePx(getNowTopPx())
    const interval = setInterval(() => setNowLinePx(getNowTopPx()), 60_000)
    return () => clearInterval(interval)
  }, [])

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
          const titleLower = (e.title ?? '').toLowerCase()
          // Never classify as kid if it's a work/personal/primary calendar
          const isWorkCal = name.includes('work') || name.includes('sensforge') ||
            name.includes('ruizhi') || name.includes('primary') || name.includes('personal') ||
            name === 'ruizhi.hong@gmail.com' || (e.calendarName ?? '').includes('@')
          // Kid event detection — calendar name keywords only (no title matching to avoid false positives)
          const isKid = !isWorkCal && (
            name.includes('kid') || name.includes('hunter') ||
            name.includes('hayden') || name.includes('baseball') ||
            name.includes('soccer') || name.includes('activit') || name.includes('4v4')
          )
          return { id: e.id, title: e.title, start: e.start, end: e.end, isAllDay: e.isAllDay, calendarName: e.calendarName, calendarColor: e.calendarColor, source: e.source, isKid }
        })

        // Dedup spouse events
        const myKeys = new Set(allEvents.map(e => `${e.title.toLowerCase().trim()}::${e.start.slice(0,16)}`))
        const memberEvts: MemberEvent[] = (memberRes.memberEvents ?? []).filter((me: MemberEvent) => {
          if (me.isAllDay) return false
          return !myKeys.has(`${(me.title ?? '').toLowerCase().trim()}::${me.start.slice(0,16)}`)
        })

        const myEvs = allEvents.filter(e => !e.isKid)
        const kidEvs = allEvents.filter(e => e.isKid)
        setMyEvents(myEvs)
        setKidEvents(kidEvs)
        setSpouseEvents(memberEvts)
        setAssignments(assignRes.assignments ?? [])
        setNotifications(notifRes.notifications ?? [])

        // Load event reminders for all visible events
        const allIds = [...myEvs, ...kidEvs].map(e => e.id).filter(Boolean)
        if (allIds.length > 0) {
          fetch(`/api/event-reminders?event_ids=${allIds.join(',')}`)
            .then(r => r.json())
            .then(d => {
              const map: Record<string, Array<{id:string;label:string;done:boolean}>> = {}
              for (const r of (d.reminders ?? [])) {
                if (!map[r.event_id]) map[r.event_id] = []
                map[r.event_id].push({ id: r.id, label: r.label, done: r.done })
              }
              setRemindersMap(map)
            }).catch(() => {})
        }

        // Always set spouse profile — prefer from events (has profile ID), fallback to family members
        // Do NOT let dedup prevent the spouse column from showing
        const allMemberEvts: MemberEvent[] = memberRes.memberEvents ?? []
        if (allMemberEvts.length > 0) {
          const first = allMemberEvts[0]
          setSpouseProfile({ id: first.memberId, name: first.memberName, color: first.memberColor })
        } else {
          // Fetch from family members (when spouse has no events today)
          try {
            const famRes = await fetch('/api/family/members')
            if (famRes.ok) {
              const famData = await famRes.json()
              const spouses = (famData.members ?? []).filter((m: any) =>
                m.role !== 'me' && m.role !== 'kid' && m.invite_status === 'accepted')
              if (spouses.length > 0) {
                const sp = spouses[0]
                setSpouseProfile({ id: sp.id, name: sp.name, color: sp.color ?? '#6366f1' })
              }
            }
          } catch { /* ignore */ }
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
    // Optimistic update — immediate visual feedback
    setAssignments(prev => {
      const existing = prev.find(a => a.event_id === eventId)
      const optimisticStatus = (!profileId || profileId === myProfileId || profileId === 'both' || profileId === 'none' || profileId === 'skip')
        ? 'confirmed' : 'pending'
      if (!profileId) return prev.filter(a => a.event_id !== eventId)
      if (existing) return prev.map(a => a.event_id === eventId ? { ...a, assigned_to: profileId, status: optimisticStatus } : a)
      return [...prev, { id: 'optimistic-' + eventId, event_id: eventId, assigned_to: profileId, status: optimisticStatus }]
    })
    // Persist to server
    await fetch('/api/coordination/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, assigned_to_profile_id: profileId }),
    })
    await loadAssignments() // reconcile with real server state
  }

  const requestSwitch = async (assignmentId: string) => {
    setSwitchLoading(assignmentId)
    await fetch('/api/coordination/switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId }),
    })
    setSwitchLoading(null)
  }

  // ── Kid event placement state machine ────────────────────────────────────
  // skipped  → hidden entirely
  // none     → full-width, faded dashed (remote event, still visible)
  // myId     → my column only (left half)
  // spouseId → spouse column only (right half)
  // both     → both columns
  // unset    → full-width orange "Driver?" prompt

  const getAssignment = (e: CalEvent) => assignments.find(x => x.event_id === e.id)

  // Skipped: hidden
  const visibleKidEvents = kidEvents.filter(e => getAssignment(e)?.assigned_to !== 'skip')

  // Full-width: unassigned OR 'none' (no driver needed — stays visible full-width)
  const fullWidthKids = visibleKidEvents.filter(e => {
    const a = getAssignment(e)
    return !a || !a.assigned_to || a.assigned_to === 'none'
  })

  // My column: assigned to me or 'both'
  const myKidsInCol = visibleKidEvents.filter(e => {
    const a = getAssignment(e)
    return a && (a.assigned_to === myProfileId || a.assigned_to === 'both')
  })

  // Spouse column: assigned to spouse or 'both'
  const spouseKidsInCol = spouseProfile ? visibleKidEvents.filter(e => {
    const a = getAssignment(e)
    return a && (a.assigned_to === spouseProfile.id || a.assigned_to === 'both')
  }) : []

  const myColEvents = [
    ...myEvents.filter(e => !e.isAllDay),
    ...myKidsInCol,
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  const spouseColEvents = [
    ...spouseEvents,
    ...spouseKidsInCol,
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

          {/* Current time marker — only show when viewing today */}
          {date === new Date().toLocaleDateString('en-CA', { timeZone: getDeviceTz() }) && (() => {
            const nowMins = toMinutesFromMidnight(new Date().toISOString())
            const nowTop = Math.max(0, (nowMins - START_HOUR * 60) / 60 * HOUR_HEIGHT)
            return nowTop < GRID_HEIGHT ? (
              <div className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
                style={{ top: nowTop }}>
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
                <div className="flex-1 border-t-2 border-red-400" />
              </div>
            ) : null
          })()}

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
              remindersMap={remindersMap}
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
                remindersMap={remindersMap}
              />
            </div>
          )}

          {/* Current time marker */}
          {nowLinePx !== null && (
            <div className="absolute left-0 right-0 pointer-events-none" style={{ top: nowLinePx, zIndex: 20 }}>
              <div className="absolute" style={{ left: 0, top: -4, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ height: 2, backgroundColor: '#ef4444', marginLeft: 8 }} />
            </div>
          )}

          {/* Full-width kids: unassigned (Driver? prompt) or 'none' (no driver needed, faded) */}
          {/* Apply left-offset stacking for overlapping full-width kids — same 12px offset as CalColumn */}
          {fullWidthKids.map((ev, idx) => {
            // Count how many previous kids overlap with this one
            const overlapRank = fullWidthKids.slice(0, idx).filter(prev =>
              new Date(prev.start) < new Date(ev.end) && new Date(ev.start) < new Date(prev.end)
            ).length
            return (
              <KidFullWidth
                key={ev.id}
                ev={ev}
                myProfileId={myProfileId}
                spouseProfile={spouseProfile}
                assignment={getAssignment(ev) ?? null}
                onAssign={assignEvent}
                stackOffset={overlapRank * 12}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
