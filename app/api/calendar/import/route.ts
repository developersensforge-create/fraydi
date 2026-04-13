import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// POST /api/calendar/import
// Body: { ical_url: string, profile_id: string, family_id: string, calendar_name: string, color: string }
// Fetches the iCal URL, parses events, upserts into calendar_events table

interface ImportBody {
  ical_url: string
  profile_id: string
  family_id: string
  calendar_name: string
  color: string
}

interface ParsedEvent {
  uid: string
  title: string
  start_time: string
  end_time: string
  description: string | null
  location: string | null
}

/**
 * Parse iCal text into a list of events.
 * Uses node-ical when available; falls back to a lightweight regex parser.
 */
async function parseIcal(icalText: string): Promise<ParsedEvent[]> {
  // TODO: replace stub with node-ical when build pipeline confirms it is compatible.
  // Example with node-ical:
  //   import * as ical from 'node-ical'
  //   const parsed = ical.parseICS(icalText)
  //   for (const key in parsed) { const ev = parsed[key]; if (ev.type === 'VEVENT') { ... } }

  const events: ParsedEvent[] = []

  // Lightweight line-by-line iCal parser (handles most VEVENT blocks)
  const lines = icalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let inEvent = false
  let current: Record<string, string> = {}

  const unfold = (line: string) => line.replace(/\n[ \t]/g, '')

  for (let i = 0; i < lines.length; i++) {
    const line = unfold(lines[i])
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
    } else if (line === 'END:VEVENT') {
      inEvent = false
      if (current['UID']) {
        const parseDate = (fullLine: string): string => {
          // fullLine may be "DTSTART;TZID=Eastern Standard Time:20260415T133000"
          // or just the value "20260415T133000Z"
          const colonIdx = fullLine.indexOf(':')
          const params = colonIdx > -1 ? fullLine.slice(0, colonIdx).toUpperCase() : ''
          const v = colonIdx > -1 ? fullLine.slice(colonIdx + 1).trim() : fullLine.trim()

          if (v.length === 8) {
            // All-day: YYYYMMDD — store as midnight Eastern
            return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T00:00:00-05:00`
          }
          const y = v.slice(0, 4)
          const mo = v.slice(4, 6)
          const d = v.slice(6, 8)
          const h = v.slice(9, 11)
          const mi = v.slice(11, 13)
          const s = v.slice(13, 15) || '00'

          if (v.endsWith('Z')) {
            // Explicit UTC marker — store as-is
            return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
          }

          // TZID present — use the offset. Eastern Standard = -05:00, Eastern Daylight = -04:00
          // Determine DST: rough rule — EDT (Mar 2nd Sun to Nov 1st Sun)
          const tzid = params.includes('TZID=') ? params.split('TZID=')[1] : ''
          if (tzid.includes('EASTERN') || tzid.includes('AMERICA/NEW_YORK') || tzid.includes('EST') || tzid.includes('EDT')) {
            const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`)
            const month = parseInt(mo)
            const isDST = month > 3 && month < 11 // rough EDT: Apr–Oct
            const offset = isDST ? '-04:00' : '-05:00'
            return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`
          }
          if (tzid.includes('PACIFIC') || tzid.includes('PST') || tzid.includes('PDT')) {
            const month = parseInt(mo)
            const isDST = month > 3 && month < 11
            const offset = isDST ? '-07:00' : '-08:00'
            return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`
          }
          if (tzid.includes('CENTRAL') || tzid.includes('CST') || tzid.includes('CDT')) {
            const month = parseInt(mo)
            const isDST = month > 3 && month < 11
            const offset = isDST ? '-05:00' : '-06:00'
            return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`
          }
          // No timezone info — assume US Eastern (default per product rules)
          const month = parseInt(mo)
          const isDST = month > 3 && month < 11
          const offset = isDST ? '-04:00' : '-05:00'
          return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`
        }

        // Use full DTSTART line (includes TZID params) for correct parsing
        const startRaw = current['_DTSTART_FULL'] || current['DTSTART'] || current['DTSTART;VALUE=DATE'] || ''
        const endRaw = current['_DTEND_FULL'] || current['DTEND'] || current['DTEND;VALUE=DATE'] || startRaw

        events.push({
          uid: current['UID'],
          title: (current['SUMMARY'] || 'Untitled').replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\/g, ''),
          start_time: startRaw ? parseDate(startRaw) : new Date().toISOString(),
          end_time: endRaw ? parseDate(endRaw) : new Date().toISOString(),
          description: current['DESCRIPTION']
            ? current['DESCRIPTION'].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\/g, '')
            : null,
          location: current['LOCATION']
            ? current['LOCATION'].replace(/\\,/g, ',').replace(/\\/g, '')
            : null,
        })
      }
    } else if (inEvent) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > -1) {
        const key = line.slice(0, colonIdx).toUpperCase()
        const val = line.slice(colonIdx + 1)
        // Store base key (ignore params for most fields, keep full key for date fields)
        const baseKey = key.split(';')[0]
        if (['DTSTART', 'DTEND'].includes(baseKey)) {
          current[baseKey] = val
          // Store full "KEY:val" line so parseDate can access TZID params
          current[`_${baseKey}_FULL`] = `${key}:${val}`
        } else {
          current[baseKey] = val
        }
      }
    }
  }

  return events
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportBody = await request.json()
    const { ical_url: raw_ical_url, profile_id, family_id, calendar_name, color } = body
    // Normalize webcal:// → https:// (webcal is the same protocol, just a different scheme)
    const ical_url = typeof raw_ical_url === 'string'
      ? raw_ical_url.replace(/^webcal:\/\//i, 'https://')
      : raw_ical_url

    if (!ical_url || !profile_id || !family_id) {
      return NextResponse.json(
        { error: 'ical_url, profile_id, and family_id are required' },
        { status: 400 }
      )
    }

    // Fetch the iCal feed
    let icalText: string
    try {
      const response = await fetch(ical_url, {
        headers: { 'User-Agent': 'Fraydi/1.0 iCal Importer' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch iCal URL: HTTP ${response.status}` },
          { status: 422 }
        )
      }
      icalText = await response.text()
    } catch (fetchErr) {
      return NextResponse.json(
        { error: `Could not reach iCal URL: ${(fetchErr as Error).message}` },
        { status: 422 }
      )
    }

    // Parse events
    const events = await parseIcal(icalText)

    if (events.length === 0) {
      return NextResponse.json({ imported: 0, message: 'No events found in iCal feed' })
    }

    // Upsert events into calendar_events (deduplicate on google_event_id = iCal UID)
    const rows = events.map((ev) => ({
      family_id,
      profile_id,
      google_event_id: ev.uid,
      title: ev.title,
      description: ev.description,
      start_time: ev.start_time,
      end_time: ev.end_time,
      location: ev.location,
      is_child_event: false,
      requires_coverage: false,
      assignment_confirmed: false,
    }))

    const db = createServerSupabase()

    // Find or create the calendar_source record first to get its ID
    const { data: existingSource } = await db.from('calendar_sources')
      .select('id').eq('ical_url', ical_url).single()

    const sourceId = existingSource?.id ?? null

    // Deduplicate by google_event_id (UID) — keep last occurrence (most recent data)
    const deduped = new Map<string, typeof rows[0]>()
    for (const r of rows) { deduped.set(r.google_event_id, r) }
    const rowsWithSource = Array.from(deduped.values()).map(r => ({ ...r, calendar_source_id: sourceId }))

    const { error: upsertError } = await db
      .from('calendar_events')
      .upsert(rowsWithSource, { onConflict: 'google_event_id' })

    if (upsertError) {
      console.error('[calendar/import] Supabase upsert error:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Upsert the calendar_source record
    const { error: sourceError } = await db.from('calendar_sources').upsert(
      {
        profile_id,
        family_id,
        name: calendar_name || 'Imported Calendar',
        ical_url,
        color: color || '#f96400',
        last_synced_at: new Date().toISOString(),
        event_count: events.length,
      },
      { onConflict: 'ical_url' }
    )

    if (sourceError) {
      // Non-fatal — log and continue
      console.warn('[calendar/import] calendar_sources upsert warning:', sourceError)
    }

    return NextResponse.json({ imported: events.length, message: 'Import successful' })
  } catch (err) {
    console.error('[calendar/import] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
