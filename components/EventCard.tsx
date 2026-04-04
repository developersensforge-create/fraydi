"use client"

export type FamilyEvent = {
  id: string
  time: string
  title: string
  memberName: string
  memberColor: string
  requiresCoverage?: boolean
}

type Props = {
  event: FamilyEvent
}

export default function EventCard({ event }: Props) {
  return (
    <div className="flex items-start gap-3 py-2">
      {/* Time */}
      <span className="w-16 flex-shrink-0 text-right text-xs font-medium text-gray-400 pt-0.5">
        {event.time}
      </span>

      {/* Color dot */}
      <div
        className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: event.memberColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
          {event.requiresCoverage && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
              ⚠️ Needs coverage
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{event.memberName}</p>
      </div>
    </div>
  )
}
