import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getEventsForDate, CalendarEvent } from '@/lib/googleCalendar'

type Conflict = {
  event1: CalendarEvent
  event2: CalendarEvent
  overlapStart: string
  overlapEnd: string
  severity: 'hard' | 'soft'
}

function detectConflicts(events: CalendarEvent[]): Conflict[] {
  const conflicts: Conflict[] = []

  // Only consider timed events (not all-day)
  const timedEvents = events.filter((e) => !!e.start.dateTime)

  for (let i = 0; i < timedEvents.length; i++) {
    for (let j = i + 1; j < timedEvents.length; j++) {
      const a = timedEvents[i]
      const b = timedEvents[j]

      const aStart = new Date(a.start.dateTime ?? a.start.date ?? '')
      const aEnd = new Date(a.end.dateTime ?? a.end.date ?? '')
      const bStart = new Date(b.start.dateTime ?? b.start.date ?? '')
      const bEnd = new Date(b.end.dateTime ?? b.end.date ?? '')

      if (isNaN(aStart.getTime()) || isNaN(aEnd.getTime()) || isNaN(bStart.getTime()) || isNaN(bEnd.getTime())) {
        continue
      }

      // Check overlap: a starts before b ends AND b starts before a ends
      if (aStart < bEnd && bStart < aEnd) {
        const overlapStart = bStart > aStart ? bStart : aStart
        const overlapEnd = aEnd < bEnd ? aEnd : bEnd

        conflicts.push({
          event1: a,
          event2: b,
          overlapStart: overlapStart.toISOString(),
          overlapEnd: overlapEnd.toISOString(),
          severity: 'hard',
        })
      }
    }
  }

  return conflicts
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as { accessToken?: string } | null

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const dateStr = searchParams.get('date') ?? undefined
  const tz = searchParams.get('tz') ?? undefined

  // Fetch all events across all calendars for the given date + timezone
  const result = await getEventsForDate(session.accessToken, dateStr, tz)

  if ('error' in result) {
    return NextResponse.json({ error: result.error, conflicts: [] }, { status: result.status === 401 ? 403 : 500 })
  }

  const conflicts = detectConflicts(result)

  return NextResponse.json({
    date: dateStr ?? new Date().toISOString().split('T')[0],
    tz: tz ?? 'UTC',
    total_events: result.length,
    conflicts,
    conflict_count: conflicts.length,
  })
}
