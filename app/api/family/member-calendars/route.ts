/**
 * GET  /api/family/member-calendars?member_profile_id=xxx
 *   Returns list of a family member's Google calendars (fetched using their stored token)
 *   plus viewer's visibility prefs for each
 *
 * PATCH /api/family/member-calendars
 *   Body: { member_profile_id, google_calendar_id, visible, display_name? }
 *   Saves viewer preference for one of the member's calendars
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberProfileId = req.nextUrl.searchParams.get('member_profile_id')
  if (!memberProfileId) return NextResponse.json({ error: 'member_profile_id required' }, { status: 400 })

  const db = createServerSupabase()

  // Get viewer's profile
  const { data: myProfile } = await db.from('profiles').select('id, family_id').eq('email', session.user.email).single()
  if (!myProfile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  // Get member's stored Google token
  const { data: tokenRow } = await db
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('profile_id', memberProfileId)
    .single()

  if (!tokenRow?.access_token) return NextResponse.json({ error: 'Member has no calendar token', calendars: [] })

  // Refresh token if expired
  let accessToken = tokenRow.access_token
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    if (!tokenRow.refresh_token) return NextResponse.json({ error: 'Token expired', calendars: [] })
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
      }),
    })
    if (refreshRes.ok) {
      const refreshed = await refreshRes.json()
      accessToken = refreshed.access_token
      await db.from('google_calendar_tokens').update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('profile_id', memberProfileId)
    } else {
      return NextResponse.json({ error: 'Token refresh failed', calendars: [] })
    }
  }

  // Fetch member's calendar list from Google
  const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!calRes.ok) return NextResponse.json({ error: 'Failed to fetch calendars', calendars: [] })
  const calData = await calRes.json()
  const googleCals: Array<{ id: string; summary: string; backgroundColor: string; primary?: boolean }> = calData.items ?? []

  // Get viewer's saved prefs for this member's calendars
  const { data: prefs } = await db
    .from('family_member_cal_prefs')
    .select('google_calendar_id, display_name, visible')
    .eq('viewer_profile_id', myProfile.id)
    .eq('member_profile_id', memberProfileId)

  const prefMap = new Map((prefs ?? []).map(p => [p.google_calendar_id, p]))

  const calendars = googleCals.map(cal => {
    const pref = prefMap.get(cal.id)
    return {
      id: cal.id,
      name: pref?.display_name ?? cal.summary ?? 'Calendar',
      color: cal.backgroundColor ?? '#6366f1',
      primary: cal.primary ?? false,
      visible: pref?.visible ?? true, // default visible
    }
  })

  return NextResponse.json({ calendars, memberProfileId })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { member_profile_id, google_calendar_id, visible, display_name } = await req.json()
  if (!member_profile_id || !google_calendar_id) {
    return NextResponse.json({ error: 'member_profile_id and google_calendar_id required' }, { status: 400 })
  }

  const db = createServerSupabase()
  const { data: myProfile } = await db.from('profiles').select('id, family_id').eq('email', session.user.email).single()
  if (!myProfile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  await db.from('family_member_cal_prefs').upsert({
    family_id: myProfile.family_id,
    viewer_profile_id: myProfile.id,
    member_profile_id,
    google_calendar_id,
    visible: visible ?? true,
    display_name: display_name ?? null,
  }, { onConflict: 'viewer_profile_id,member_profile_id,google_calendar_id' })

  return NextResponse.json({ ok: true })
}
