import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { scrapeEventsFromUrl } from '@/lib/aiScraper'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

// POST /api/admin/seed-watch?secret=xxx&source_id=xxx
// One-time use: triggers a sync for a watch source server-side (no session needed)
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sourceId = req.nextUrl.searchParams.get('source_id')
  if (!sourceId) return NextResponse.json({ error: 'source_id required' }, { status: 400 })

  const db = createServerSupabase()
  const { data: source, error } = await db.from('watch_sources').select('*').eq('id', sourceId).single()
  if (error || !source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

  const events = await scrapeEventsFromUrl(source.url, ['kids', 'family', 'sports', 'outdoor', 'community'])
  if (!events.length) return NextResponse.json({ message: 'No events found', events_found: 0 })

  const rows = events.map(e => ({
    watch_source_id: sourceId,
    user_email: source.user_email,
    family_id: source.family_id,
    title: e.title,
    description: e.description ?? null,
    event_date: e.event_date ?? null,
    event_time: e.event_time ?? null,
    location: e.location ?? null,
    url: e.url ?? null,
    price: e.price ?? null,
    tags: e.tags ?? [],
    interest_level: 'watch',
  }))

  await db.from('watch_events').delete().eq('watch_source_id', sourceId)
  const { error: insertErr } = await db.from('watch_events').insert(rows)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  await db.from('watch_sources').update({
    last_synced_at: new Date().toISOString(),
    event_count: rows.length,
  }).eq('id', sourceId)

  return NextResponse.json({ events_found: rows.length, sample: rows.slice(0, 2) })
}
