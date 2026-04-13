import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { listCalendars, getEventsForCalendar } from '@/lib/googleCalendar'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) return NextResponse.json({ error: 'not authenticated' })

  const date = req.nextUrl.searchParams.get('date') ?? '2026-04-13'

  // Apr Eastern day: midnight EDT = +04:00 offset from date
  const dayStart = new Date(`${date}T04:00:00Z`)
  const dayEnd   = new Date(dayStart.getTime() + 86400000)

  const calendars = await listCalendars(session.accessToken)

  const results: any[] = []
  for (const cal of calendars) {
    const events = await getEventsForCalendar(session.accessToken, cal.id, dayStart.toISOString(), dayEnd.toISOString())
    results.push({
      calendar: cal.summary,
      calId: cal.id,
      count: events.length,
      events: events.map(e => ({ title: e.summary, start: e.start.dateTime ?? e.start.date }))
    })
  }

  return NextResponse.json({ date, dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(), results })
}
