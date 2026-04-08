import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { scrapeEventsFromUrl } from '@/lib/aiScraper'
import { resolveKeywords, syncIcal } from '@/lib/watchHelpers'

export const maxDuration = 300

// GET /api/cron/sync-watch — daily cron to sync all active watch sources
export async function GET() {
  const db = createServerSupabase()

  const { data: sources, error } = await db
    .from('watch_sources')
    .select('*')
    .eq('active', true)

  if (error) {
    console.error('[cron/sync-watch] fetch sources error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!sources || sources.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No active sources' })
  }

  const results: Array<{
    id: string
    name: string
    type: string
    events_found: number
    error?: string
  }> = []

  for (const source of sources) {
    try {
      if (source.type === 'url' && source.url) {
        const keywords = await resolveKeywords(db, source.interest_keywords, source.family_id)
        const scraped = await scrapeEventsFromUrl(source.url, keywords)

        if (scraped.length > 0) {
          await db.from('watch_events').delete().eq('watch_source_id', source.id)
          const rows = scraped.map(e => ({
            watch_source_id: source.id,
            user_email: source.user_email,
            family_id: source.family_id,
            title: e.title,
            description: e.description ?? null,
            event_date: e.event_date ?? null,
            event_time: e.event_time ?? null,
            location: e.location ?? null,
            url: e.url ?? null,
          }))
          await db.from('watch_events').insert(rows)
          await db
            .from('watch_sources')
            .update({ last_synced_at: new Date().toISOString(), event_count: scraped.length })
            .eq('id', source.id)
          results.push({ id: source.id, name: source.name, type: source.type, events_found: scraped.length })
        } else {
          await db
            .from('watch_sources')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', source.id)
          results.push({ id: source.id, name: source.name, type: source.type, events_found: 0 })
        }
      } else if (source.type === 'ical' && source.url) {
        const count = await syncIcal(
          db,
          { id: source.id, url: source.url },
          source.user_email,
          source.family_id
        )
        results.push({ id: source.id, name: source.name, type: source.type, events_found: count })
      } else {
        results.push({
          id: source.id,
          name: source.name,
          type: source.type,
          events_found: 0,
          error: 'No URL or unsupported type',
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[cron/sync-watch] source ${source.id} failed:`, msg)
      results.push({ id: source.id, name: source.name, type: source.type, events_found: 0, error: msg })
    }
  }

  const total = results.reduce((sum, r) => sum + r.events_found, 0)
  console.log(`[cron/sync-watch] done — ${sources.length} sources, ${total} events found`)

  return NextResponse.json({ synced: sources.length, total_events: total, results })
}
