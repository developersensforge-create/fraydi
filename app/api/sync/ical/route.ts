import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { fetchAndParseIcal } from '@/lib/icalParser'

// POST /api/sync/ical — manually trigger sync of all iCal sources for current user's family
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('id, family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'Not in a family', synced: 0, eventCounts: [] }, { status: 400 })
    }

    // Fetch all active calendar sources for this family
    const { data: sources, error: sourcesError } = await db
      .from('calendar_sources')
      .select('*')
      .eq('family_id', profile.family_id)

    if (sourcesError) {
      return NextResponse.json({ error: sourcesError.message }, { status: 500 })
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({ synced: 0, eventCounts: [] })
    }

    const results: { sourceId: string; name: string; count: number; error?: string }[] = []

    for (const source of sources) {
      try {
        const events = await fetchAndParseIcal(source.ical_url)

        // Upsert events
        const rows = events.map((ev) => ({
          family_id: source.family_id,
          profile_id: source.profile_id,
          google_event_id: ev.uid,
          title: ev.title,
          description: ev.description,
          start_time: ev.start_time,
          end_time: ev.end_time,
          location: ev.location,
          calendar_source_id: source.id,
          is_child_event: false,
          requires_coverage: false,
          assignment_confirmed: false,
        }))

        if (rows.length > 0) {
          await db
            .from('calendar_events')
            .upsert(rows, { onConflict: 'google_event_id' })
        }

        // Update last_synced_at and event_count
        await db
          .from('calendar_sources')
          .update({
            last_synced_at: new Date().toISOString(),
            event_count: events.length,
          })
          .eq('id', source.id)

        results.push({ sourceId: source.id, name: source.name, count: events.length })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[sync/ical] Failed to sync source ${source.id}:`, msg)
        results.push({ sourceId: source.id, name: source.name, count: 0, error: msg })
      }
    }

    const synced = results.filter((r) => !r.error).length
    return NextResponse.json({ synced, eventCounts: results })
  } catch (err) {
    console.error('[POST /api/sync/ical]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
