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
  const targetDate = dateStr ? new Date(dateStr) : new Date()

  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const events = await getEventsForDate(session.accessToken, targetDate)
  return NextResponse.json({ events })
}
