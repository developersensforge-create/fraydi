import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { scrapeEventsFromUrl } from '@/lib/aiScraper'
import { resolveKeywords, syncIcal } from '@/lib/watchHelpers'

// POST /api/watch/sources/[id]/sync — manually re-sync a watch source
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userEmail = session.user.email

  const { id } = params
  const db = createServerSupabase()

  const { data: source, error: srcError } = await db
    .from('watch_sources')
    .select('*')
    .eq('id', id)
    .single()

  if (srcError || !source) {
    return NextResponse.json({ error: 'Watch source not found' }, { status: 404 })
  }

  let events_found = 0
  let events: unknown[] = []

  if (source.type === 'url' && source.url) {
    const keywords = await resolveKeywords(db, source.interest_keywords, source.family_id)
    const scraped = await scrapeEventsFromUrl(source.url, keywords)

    if (scraped.length > 0) {
      await db.from('watch_events').delete().eq('watch_source_id', id)

      const rows = scraped.map(e => ({
        watch_source_id: id,
        user_email: userEmail,
        family_id: source.family_id,
        title: e.title,
        description: e.description ?? null,
        event_date: e.event_date ?? null,
        event_time: e.event_time ?? null,
        location: e.location ?? null,
        url: e.url ?? null,
      }))

      const { data: inserted } = await db.from('watch_events').insert(rows).select()
      events_found = scraped.length
      events = inserted ?? []
    }

    await db
      .from('watch_sources')
      .update({ last_synced_at: new Date().toISOString(), event_count: events_found })
      .eq('id', id)
  } else if (source.type === 'ical' && source.url) {
    events_found = await syncIcal(
      db,
      { id, url: source.url },
      userEmail,
      source.family_id
    )

    if (events_found > 0) {
      const { data: fetched } = await db
        .from('watch_events')
        .select('*')
        .eq('watch_source_id', id)
        .order('event_date', { ascending: true })
      events = fetched ?? []
    }
  } else {
    return NextResponse.json(
      { error: 'Source has no URL or unsupported type' },
      { status: 400 }
    )
  }

  return NextResponse.json({ events_found, events })
}
