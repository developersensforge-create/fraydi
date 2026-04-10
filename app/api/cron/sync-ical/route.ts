import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { fetchAndParseIcal } from '@/lib/icalParser'

// This endpoint is called by Vercel Cron every 4 hours
// GET /api/cron/sync-ical
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServerSupabase()

    // Fetch ALL active calendar sources across all users
    const { data: sources, error } = await db
      .from('calendar_sources')
      .select('*')

    if (error) {
      console.error('[cron/sync-ical] Failed to fetch sources:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({ synced: 0, total: 0 })
    }

    let synced = 0
    let failed = 0

    for (const source of sources) {
      try {
        const events = await fetchAndParseIcal(source.ical_url)

        const rows = events.map((ev) => ({
          family_id: source.family_id,
          profile_id: source.profile_id,
          google_event_id: `${source.id}::${ev.uid}`,
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
          // Delete old events for this source first, then insert fresh (avoids stale key mismatch)
          await db.from('calendar_events').delete().eq('calendar_source_id', source.id)
          await db.from('calendar_events').insert(rows)
        }

        await db
          .from('calendar_sources')
          .update({
            last_synced_at: new Date().toISOString(),
            event_count: events.length,
          })
          .eq('id', source.id)

        synced++
      } catch (err) {
        console.error(`[cron/sync-ical] Error syncing source ${source.id}:`, err)
        failed++
      }
    }

    console.log(`[cron/sync-ical] Done: ${synced} synced, ${failed} failed`)
    return NextResponse.json({ synced, failed, total: sources.length })
  } catch (err) {
    console.error('[cron/sync-ical] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
