/**
 * GET /api/family/conflicts?date=YYYY-MM-DD
 *
 * Smart conflict detection:
 * - Kids events (from calendar_sources with owner_type='kid') require 1 adult each
 * - Each kid event window = event start - 30min to event end + 30min (prep/commute buffer)
 * - Adults = family members who have connected Google calendars (google_calendar_tokens)
 * - Conflict = kid event window where all adults are busy at the same time
 * - Double conflict = two kids have overlapping events with only one free adult
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { getEventsForDate } from '@/lib/googleCalendar'

const BUFFER_MS = 30 * 60 * 1000 // 30 minutes

type ConflictAlert = {
  id: string
  type: 'no_coverage' | 'split_kids'
  kidEvent: { title: string; start: string; end: string; kidName?: string }
  conflictingAdultEvents: Array<{ personName: string; title: string; color: string }>
  windowStart: string
  windowEnd: string
  suggestion: string
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

  // Get current user's family
  const { data: myProfile } = await db
    .from('profiles')
    .select('id, family_id, full_name, color')
    .eq('email', session.user.email)
    .single()

  if (!myProfile?.family_id) return NextResponse.json({ conflicts: [] })

  // ── 1. Get kids calendar events for this date ───────────────────────────
  const dayStart = new Date(y, m - 1, d, 0, 0, 0).toISOString()
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59).toISOString()

  const { data: kidSources } = await db
    .from('calendar_sources')
    .select('id, name, owner_name, owner_member_name, color')
    .eq('family_id', myProfile.family_id)
    .eq('owner_type', 'kid')
    .eq('active', true)

  if (!kidSources?.length) return NextResponse.json({ conflicts: [] })

  const sourceIds = kidSources.map(s => s.id)
  const sourceMap = new Map(kidSources.map(s => [s.id, s]))

  const { data: kidEvents } = await db
    .from('calendar_events')
    .select('id, title, start_time, end_time, calendar_source_id')
    .in('calendar_source_id', sourceIds)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .order('start_time', { ascending: true })

  if (!kidEvents?.length) return NextResponse.json({ conflicts: [] })

  // ── 2. Get all adults' Google Calendar events ───────────────────────────
  const { data: familyProfiles } = await db
    .from('profiles')
    .select('id, full_name, color, email')
    .eq('family_id', myProfile.family_id)

  const profileIds = (familyProfiles ?? []).map(p => p.id)
  const { data: tokens } = await db
    .from('google_calendar_tokens')
    .select('profile_id, access_token, expires_at')
    .in('profile_id', profileIds)

  const tokenMap = new Map((tokens ?? []).map(t => [t.profile_id, t]))
  const profileMap = new Map((familyProfiles ?? []).map(p => [p.id, p]))

  // Add current user's session token if not in DB yet
  if (session.accessToken && !tokenMap.has(myProfile.id)) {
    tokenMap.set(myProfile.id, { profile_id: myProfile.id, access_token: session.accessToken, expires_at: null })
  }

  // Fetch each adult's events
  const adultEventsByProfile = new Map<string, Array<{ title: string; start: Date; end: Date }>>()

  await Promise.all(
    Array.from(tokenMap.entries()).map(async ([profileId, tokenRow]) => {
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return
      try {
        const events = await getEventsForDate(tokenRow.access_token, targetDate)
        const timedEvents = events
          .filter(e => e.start.dateTime)
          .map(e => ({
            title: e.summary ?? 'Busy',
            start: new Date(e.start.dateTime!),
            end: new Date(e.end.dateTime ?? e.start.dateTime!),
          }))
        adultEventsByProfile.set(profileId, timedEvents)
      } catch { /* skip */ }
    })
  )

  // ── 2b. Build shared event set ──────────────────────────────────────────
  // A "shared" event is one that appears on multiple adults' calendars with
  // the same normalized title AND overlapping times — both parents attending together.
  // Key: normalized title + overlapping adult profile IDs
  type SharedEventKey = string // `${normalizedTitle}::${start.toISOString()}`

  const sharedEventKeys = new Set<string>()

  const adultProfileList = Array.from(adultEventsByProfile.entries())
  for (let i = 0; i < adultProfileList.length; i++) {
    for (let j = i + 1; j < adultProfileList.length; j++) {
      const [, eventsA] = adultProfileList[i]
      const [, eventsB] = adultProfileList[j]
      for (const a of eventsA) {
        const normA = a.title.toLowerCase().trim()
        for (const b of eventsB) {
          const normB = b.title.toLowerCase().trim()
          if (normA === normB && a.start < b.end && b.start < a.end) {
            // Both adults have the same event — mark as shared
            sharedEventKeys.add(`${normA}::${a.start.toISOString()}`)
            sharedEventKeys.add(`${normB}::${b.start.toISOString()}`)
          }
        }
      }
    }
  }

  const isSharedEvent = (ev: { title: string; start: Date }): boolean => {
    return sharedEventKeys.has(`${ev.title.toLowerCase().trim()}::${ev.start.toISOString()}`)
  }

  // ── 3. Detect conflicts ─────────────────────────────────────────────────
  const conflicts: ConflictAlert[] = []

  // Group kid events by time window overlap (simultaneous kids)
  const kidEventWindows = kidEvents.map(ke => {
    const start = new Date(ke.start_time)
    const end = new Date(ke.end_time ?? ke.start_time)
    const source = sourceMap.get(ke.calendar_source_id)
    return {
      id: ke.id,
      title: ke.title,
      start, end,
      windowStart: new Date(start.getTime() - BUFFER_MS),
      windowEnd: new Date(end.getTime() + BUFFER_MS),
      kidName: source?.owner_name ?? source?.owner_member_name ?? source?.name ?? 'Kid',
      color: source?.color ?? '#6366f1',
    }
  })

  // For each kid event window, find which adults are busy
  for (let i = 0; i < kidEventWindows.length; i++) {
    const kw = kidEventWindows[i]
    const busyAdults: Array<{ personName: string; title: string; color: string }> = []
    const freeAdults: string[] = []

    for (const [profileId, adultEvents] of adultEventsByProfile.entries()) {
      const profile = profileMap.get(profileId)
      if (!profile) continue
      const busy = adultEvents.filter(ae =>
        ae.start < kw.windowEnd && ae.end > kw.windowStart
      )
      // Filter out shared events — if ALL busy events are shared, adult is effectively free
      const nonSharedBusy = busy.filter(ae => {
        const key = `${ae.title.toLowerCase().trim()}::${ae.start.toISOString()}`
        return !sharedEventKeys.has(key)
      })
      if (nonSharedBusy.length > 0) {
        busyAdults.push({
          personName: profile.full_name ?? profile.email ?? 'Someone',
          title: nonSharedBusy[0].title,
          color: profile.color ?? '#6366f1',
        })
      } else {
        freeAdults.push(profile.full_name ?? 'Someone')
      }
    }

    const totalAdults = adultEventsByProfile.size

    // Detect shared/duplicate events: if ALL busy adults have same title+time, they're attending together
    // (e.g. both Ruizhi and Liwei have "Riverbats game" — that's one shared event, not a conflict)
    const isSharedEvent = busyAdults.length === totalAdults && totalAdults > 1 &&
      busyAdults.every(a => {
        const titleNorm = a.title.trim().toLowerCase().slice(0, 40)
        return busyAdults[0].title.trim().toLowerCase().slice(0, 40) === titleNorm
      })
    if (isSharedEvent) continue // Both adults at same event — no coverage conflict

    // Find simultaneous kid events
    const simultaneousKids = kidEventWindows.filter((other, j) =>
      j !== i && other.windowStart < kw.windowEnd && other.windowEnd > kw.windowStart
    )
    const kidsNeedingCoverage = 1 + simultaneousKids.length
    const freeAdultCount = freeAdults.length

    if (freeAdultCount < kidsNeedingCoverage && totalAdults > 0) {
      if (simultaneousKids.length > 0) {
        // Split kids conflict
        const alreadyAdded = conflicts.find(c => c.type === 'split_kids' &&
          c.windowStart === kw.windowStart.toISOString())
        if (!alreadyAdded) {
          conflicts.push({
            id: `split-${kw.id}`,
            type: 'split_kids',
            kidEvent: { title: kw.title, start: kw.start.toISOString(), end: kw.end.toISOString(), kidName: kw.kidName },
            conflictingAdultEvents: busyAdults,
            windowStart: kw.windowStart.toISOString(),
            windowEnd: kw.windowEnd.toISOString(),
            suggestion: `${kw.kidName} + ${simultaneousKids.map(k => k.kidName).join(' + ')} have overlapping events — only ${freeAdultCount} parent${freeAdultCount !== 1 ? 's' : ''} free`,
          })
        }
      } else if (freeAdultCount === 0) {
        // No coverage
        conflicts.push({
          id: `nocov-${kw.id}`,
          type: 'no_coverage',
          kidEvent: { title: kw.title, start: kw.start.toISOString(), end: kw.end.toISOString(), kidName: kw.kidName },
          conflictingAdultEvents: busyAdults,
          windowStart: kw.windowStart.toISOString(),
          windowEnd: kw.windowEnd.toISOString(),
          suggestion: `No one available for ${kw.kidName}'s ${kw.title} (${new Date(kw.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`,
        })
      }
    }
  }

  return NextResponse.json({ conflicts, date: dateParam })
}
