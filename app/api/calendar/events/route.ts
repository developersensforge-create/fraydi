import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getEventsForDate } from '@/lib/googleCalendar'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as { accessToken?: string } | null

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const dateStr = req.nextUrl.searchParams.get('date')

  // Parse date as local noon to avoid UTC boundary issues (e.g. "2026-04-09" UTC midnight = April 8 in US timezones)
  let targetDate: Date
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number)
    targetDate = new Date(y, m - 1, d, 12, 0, 0)
  } else {
    targetDate = new Date()
  }

  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const events = await getEventsForDate(session.accessToken, targetDate)
  return NextResponse.json({ events })
}
