import { Card, CardHeader, CardBody } from '@/components/ui/Card'

// Placeholder data — replace with real Supabase/Google Calendar data
const placeholderEvents = [
  { id: 1, time: '8:00 AM', title: 'School drop-off', member: 'Mum', color: '#f96400' },
  { id: 2, time: '9:30 AM', title: 'Dentist appointment', member: 'Emma', color: '#6366f1' },
  { id: 3, time: '12:00 PM', title: 'Lunch prep', member: 'Dad', color: '#10b981' },
  { id: 4, time: '3:30 PM', title: 'Football practice', member: 'Jack', color: '#f59e0b' },
  { id: 5, time: '6:00 PM', title: 'Family dinner', member: 'Everyone', color: '#ec4899' },
]

/**
 * FamilyTimeline
 * Displays a chronological list of today's events across all family members.
 * TODO: Connect to Google Calendar API via /lib/googleCalendar.ts
 * TODO: Fetch family member data from Supabase
 */
export default function FamilyTimeline() {
  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Family Timeline</h2>
            <p className="text-xs text-gray-400 mt-0.5">Today's schedule across the family</p>
          </div>
          <span className="text-xs font-medium text-[#f96400] bg-orange-50 px-2.5 py-1 rounded-full">
            {placeholderEvents.length} events
          </span>
        </div>
      </CardHeader>
      <CardBody>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-gray-100" />

          <ul className="space-y-4">
            {placeholderEvents.map((event) => (
              <li key={event.id} className="flex items-start gap-4">
                {/* Time */}
                <span className="w-20 flex-shrink-0 text-right text-xs font-medium text-gray-400 pt-0.5">
                  {event.time}
                </span>

                {/* Dot */}
                <div
                  className="relative z-10 mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2 border-white ring-2"
                  style={{ backgroundColor: event.color }}
                />

                {/* Event */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                  <p className="text-xs text-gray-400">{event.member}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Placeholder notice */}
        <div className="mt-6 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">
            🗓 Placeholder data · Connect Google Calendar to see real events
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
