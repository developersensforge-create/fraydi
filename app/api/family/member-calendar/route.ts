import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

/**
 * POST /api/family/member-calendar
 * Add a family member's iCal feed (e.g. spouse's Google Calendar) without requiring signup.
 * Body: { member_name, ical_url, color }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { member_name, ical_url, color } = body

    if (!member_name?.trim()) return NextResponse.json({ error: 'Member name is required' }, { status: 400 })
    if (!ical_url?.trim()) return NextResponse.json({ error: 'iCal URL is required' }, { status: 400 })

    // Validate it looks like an iCal URL
    if (!ical_url.includes('calendar') && !ical_url.includes('.ics') && !ical_url.includes('ical')) {
      return NextResponse.json({ error: 'Please provide a valid iCal URL' }, { status: 400 })
    }

    const db = createServerSupabase()

    // Get current user's family
    const { data: profile } = await db
      .from('profiles')
      .select('family_id, id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'You must set up a family first' }, { status: 400 })
    }

    // Create calendar source attributed to this member
    const { data: source, error: insertError } = await db
      .from('calendar_sources')
      .insert({
        user_email: session.user.email,
        family_id: profile.family_id,
        name: `${member_name.trim()}'s Calendar`,
        member_name: member_name.trim(),
        member_color: color || '#3b82f6',
        ical_url: ical_url.trim(),
        color: color || '#3b82f6',
        active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/family/member-calendar]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Trigger iCal import in background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fraydi.vercel.app'
    fetch(`${appUrl}/api/sync/ical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
      body: JSON.stringify({ source_id: source.id }),
    }).catch(() => {}) // fire and forget

    return NextResponse.json({ source, member_name: member_name.trim() }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/family/member-calendar]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
