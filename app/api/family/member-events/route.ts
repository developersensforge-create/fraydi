/**
 * GET /api/family/member-events?date=YYYY-MM-DD&tz=...
 * Returns other family members' calendar events as a "conflict layer"
 * Only shows busy/free info by default (no titles) unless member has shared details
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { getEventsForDate } from '@/lib/googleCalendar'

export type MemberBusySlot = {
  memberId: string
  memberName: string
  memberColor: string
  start: string
  end: string
  isAllDay: boolean
  title?: string   // only if member shared details
  conflict?: boolean
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dateParam = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const [y, m, d] = dateParam.split('-').map(Number)
  const targetDate = new Date(y, m - 1, d, 12, 0, 0)

  const db = createServerSupabase()

  // Get current user's profile + family
  const { data: myProfile } = await db
    .from('profiles')
    .select('id, family_id')
    .eq('email', session.user.email)
    .single()

  if (!myProfile?.family_id) {
    return NextResponse.json({ memberEvents: [] })
  }

  // Get all other family members' profiles with their tokens
  const { data: familyProfiles } = await db
    .from('profiles')
    .select('id, email, full_name, color')
    .eq('family_id', myProfile.family_id)
    .neq('id', myProfile.id)

  if (!familyProfiles?.length) {
    return NextResponse.json({ memberEvents: [] })
  }

  // Get their stored Google tokens
  const profileIds = familyProfiles.map(p => p.id)
  const { data: tokens } = await db
    .from('google_calendar_tokens')
    .select('profile_id, access_token, expires_at')
    .in('profile_id', profileIds)

  const tokenMap = new Map((tokens ?? []).map(t => [t.profile_id, t]))

  // Fetch each member's events
  const allMemberEvents: MemberBusySlot[] = []

  await Promise.all(
    familyProfiles.map(async (member) => {
      const tokenRow = tokenMap.get(member.id)
      if (!tokenRow?.access_token) return

      // Check if token is expired (skip refresh for now — they need to re-login)
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return

      try {
        const events = await getEventsForDate(tokenRow.access_token, targetDate)
        for (const ev of events) {
          const start = ev.start.dateTime ?? ev.start.date ?? ''
          const end = ev.end.dateTime ?? ev.end.date ?? ''
          allMemberEvents.push({
            memberId: member.id,
            memberName: member.full_name ?? member.email ?? 'Family member',
            memberColor: member.color ?? '#6366f1',
            start,
            end,
            isAllDay: !ev.start.dateTime,
            title: ev.summary ?? undefined,
          })
        }
      } catch { /* skip if token invalid */ }
    })
  )

  return NextResponse.json({ memberEvents: allMemberEvents, date: dateParam })
}
