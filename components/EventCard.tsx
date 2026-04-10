'use client'

export type FamilyEvent = {
  id: string
  time: string
  title: string
  memberName: string
  memberColor: string
  requiresCoverage: boolean
  isAllDay?: boolean
  startIso?: string
  endIso?: string
}

function getEndTime(endIso?: string): string {
  if (!endIso) return ''
  try {
    return new Date(endIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

export default function EventCard({ event }: { event: FamilyEvent }) {
  if (event.isAllDay || event.time === 'All day') {
    return (
      <div className="mx-1 mb-1">
        <div
          className="rounded-lg px-3 py-1.5 flex items-center gap-2"
          style={{ backgroundColor: event.memberColor + '20', borderLeft: `3px solid ${event.memberColor}` }}
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All day</span>
          <span className="text-sm font-semibold text-gray-800 truncate flex-1">{event.title}</span>
          <span className="text-xs font-medium flex-shrink-0" style={{ color: event.memberColor }}>
            {event.memberName}
          </span>
        </div>
      </div>
    )
  }

  const endTime = getEndTime(event.endIso)

  return (
    <div className="flex items-stretch gap-3 py-1.5 group">
      {/* Time column */}
      <div className="w-16 flex-shrink-0 text-right flex flex-col justify-start pt-1">
        <span className="text-xs font-semibold text-gray-500">{event.time}</span>
        {endTime && <span className="text-[10px] text-gray-300 mt-0.5">{endTime}</span>}
      </div>

      {/* Color bar + content */}
      <div className="flex-1 min-w-0 flex items-stretch gap-2.5">
        <div className="w-1 rounded-full flex-shrink-0 self-stretch" style={{ backgroundColor: event.memberColor }} />
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{event.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: event.memberColor }} />
            <span className="text-xs text-gray-400">{event.memberName}</span>
            {event.requiresCoverage && (
              <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full font-semibold">
                Needs cover
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
