'use client'

export type FamilyEvent = {
  id: string
  time: string
  title: string
  memberName: string
  memberColor: string
  requiresCoverage: boolean
  isAllDay?: boolean
}

export default function EventCard({ event }: { event: FamilyEvent }) {
  if (event.isAllDay || event.time === 'All day') {
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="w-full rounded-lg px-3 py-2 flex items-center gap-2"
          style={{ backgroundColor: event.memberColor + '18', borderLeft: `3px solid ${event.memberColor}` }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: event.memberColor }}>
            All day
          </span>
          <span className="text-sm font-medium text-gray-800">{event.title}</span>
          <span className="ml-auto text-xs text-gray-400">{event.memberName}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Time label */}
      <div className="w-16 flex-shrink-0 text-right pt-0.5">
        <span className="text-xs font-medium text-gray-400">{event.time}</span>
      </div>

      {/* Dot */}
      <div className="flex-shrink-0 mt-1.5">
        <div
          className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
          style={{ backgroundColor: event.memberColor }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug truncate">{event.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs font-medium"
            style={{ color: event.memberColor }}
          >
            {event.memberName}
          </span>
          {event.requiresCoverage && (
            <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full font-medium">
              Needs cover
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
