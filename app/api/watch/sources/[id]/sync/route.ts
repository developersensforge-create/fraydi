import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple iCal parser — no external deps
function parseIcal(text: string): Array<{
  title: string
  start: string
  end: string
  description?: string
  url?: string
  location?: string
}> {
  const events: Array<{
    title: string
    start: string
    end: string
    description?: string
    url?: string
    location?: string
  }> = []
  const blocks = text.split('BEGIN:VEVENT')
  for (const block of blocks.slice(1)) {
    const get = (key: string): string => {
      const match = block.match(new RegExp(key + '[^:]*:([^\\r\\n]+)'))
      return match?.[1]?.trim() ?? ''
    }

    const parseIcalDate = (str: string): string => {
      // Handle TZID format: 20260406T100000 or 20260406
      const clean = str.replace(/[^0-9T]/g, '')
      if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
      }
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`
    }

    const summary = get('SUMMARY')
    const dtstart = get('DTSTART')
    if (!summary || !dtstart) continue

    events.push({
      title: summary,
      start: parseIcalDate(dtstart),
      end: parseIcalDate(get('DTEND') || dtstart),
      description: get('DESCRIPTION') || undefined,
      url: get('URL') || undefined,
      location: get('LOCATION') || undefined,
    })
  }
  return events
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  // Fetch the source record
  const { data: source, error: srcError } = await supabaseAdmin
    .from('watch_sources')
    .select('*')
    .eq('id', id)
    .single()

  if (srcError || !source) {
    return NextResponse.json({ error: 'Watch source not found' }, { status: 404 })
  }

  if (source.type !== 'ical_url' || !source.url) {
    return NextResponse.json({ error: 'Source is not an iCal URL type or has no URL' }, { status: 400 })
  }

  // Fetch the iCal feed
  let icalText: string
  try {
    const res = await fetch(source.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    icalText = await res.text()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to fetch iCal URL: ${message}` }, { status: 502 })
  }

  const parsed = parseIcal(icalText)
  if (!parsed.length) {
    return NextResponse.json({ synced: 0, message: 'No events found in iCal feed' })
  }

  // Upsert events into watch_events
  const rows = parsed.map((e) => ({
    family_id: source.family_id,
    source_id: id,
    title: e.title,
    description: e.description ?? null,
    start_time: e.start ? new Date(e.start).toISOString() : null,
    end_time: e.end ? new Date(e.end).toISOString() : null,
    location: e.location ?? null,
    url: e.url ?? null,
  }))

  // Delete old events from this source, then insert fresh
  await supabaseAdmin.from('watch_events').delete().eq('source_id', id)

  const { error: insertError } = await supabaseAdmin.from('watch_events').insert(rows)
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update last_synced_at on the source
  await supabaseAdmin
    .from('watch_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ synced: rows.length })
}
