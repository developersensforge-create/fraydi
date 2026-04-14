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
        const title = (current['SUMMARY'] || 'Untitled').replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\/g, '')
        const description = current['DESCRIPTION'] ? current['DESCRIPTION'].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\/g, '') : null
        const location = current['LOCATION'] ? current['LOCATION'].replace(/\\,/g, ',').replace(/\\/g, '') : null
        const uid = current['UID']
        const rrule = current['RRULE'] || ''
        const exdatesRaw = current['EXDATE'] || ''

        const startIso = startRaw ? parseDate(startRaw) : new Date().toISOString()
        const endIso = endRaw ? parseDate(endRaw) : new Date().toISOString()
        const duration = new Date(endIso).getTime() - new Date(startIso).getTime()

        if (rrule && rrule.includes('FREQ=WEEKLY')) {
          // Expand weekly recurrences into individual events
          const rparts: Record<string,string> = {}
          for (const part of rrule.split(';')) {
            const [k,v] = part.split('=')
            if (k && v) rparts[k] = v
          }
          const interval = parseInt(rparts['INTERVAL'] || '1')
          const byDay = (rparts['BYDAY'] || '').split(',').filter(Boolean)
          // iCal day names → JS getDay() values (0=Sun,1=Mon,...,6=Sat)
          const dayMap: Record<string,number> = {SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6}

          const untilStr = rparts['UNTIL']
          const untilMs = untilStr
            ? new Date(untilStr.length === 8
                ? `${untilStr.slice(0,4)}-${untilStr.slice(4,6)}-${untilStr.slice(6,8)}`
                : untilStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
              ).getTime()
            : Date.now() + 365 * 24 * 3600 * 1000

          const cutoffMs = Math.min(untilMs, Date.now() + 365 * 24 * 3600 * 1000)

          // Parse EXDATE — store as "YYYY-MM-DD" strings for easy comparison
          const exdates = new Set<string>()
          for (const raw of exdatesRaw.split(',')) {
            const v = raw.replace(/.*:/, '').trim()
            if (v.length >= 8) exdates.add(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`)
          }

          // Extract local date/time from startIso (ignore timezone for date arithmetic)
          // startIso looks like "2025-04-14T10:00:00-04:00"
          const [datePart, timeFull] = startIso.split('T')
          const [startY, startM, startD] = datePart.split('-').map(Number)
          const timeAndOffset = timeFull || '00:00:00-04:00'
          // Keep the offset from the original startIso
          const offsetMatch = timeAndOffset.match(/([-+]\d{2}:\d{2}|Z)$/)
          const tzOffset = offsetMatch ? offsetMatch[1] : '-04:00'
          const timeOnly = timeAndOffset.replace(/([-+]\d{2}:\d{2}|Z)$/, '').slice(0, 8) // "HH:MM:SS"

          const targetDays = byDay.map(b => dayMap[b.replace(/^[-+\d]*/,'')]).filter(n => n !== undefined)

          // Start from base date, walk by interval weeks
          // Use simple date math: days since epoch to avoid DST issues
          const msPerDay = 86400000
          const baseDate = new Date(startY, startM - 1, startD)
          const baseDayOfWeek = baseDate.getDay() // 0=Sun

          // Determine which weekdays to emit (default: same as base)
          const emitDays = targetDays.length ? targetDays : [baseDayOfWeek]

          // Walk from baseDate, week by week
          let cur = new Date(baseDate)
          let safetyCount = 0
          const nowMs = Date.now()

          while (cur.getTime() <= cutoffMs && safetyCount++ < 2000) {
            for (const targetDay of emitDays) {
              // Offset from current week's Sunday to target day
              const weekSunday = new Date(cur)
              weekSunday.setDate(cur.getDate() - cur.getDay())
              const occDate = new Date(weekSunday)
              occDate.setDate(weekSunday.getDate() + targetDay)

              if (occDate < baseDate) continue
              if (occDate.getTime() > cutoffMs) continue

              const y2 = occDate.getFullYear()
              const mo2 = String(occDate.getMonth() + 1).padStart(2, '0')
              const d2 = String(occDate.getDate()).padStart(2, '0')
              const dateStr = `${y2}-${mo2}-${d2}`
              if (exdates.has(dateStr)) continue

              const occStart = `${dateStr}T${timeOnly}${tzOffset}`
              // occEnd: plain UTC — do NOT re-attach tzOffset (would double-shift)
              const _occEndMs = new Date(occStart).getTime() + duration
              const occEnd = new Date(_occEndMs).toISOString()
              const occUid = `${uid}_${y2}${mo2}${d2}`

              events.push({ uid: occUid, title, start_time: occStart, end_time: occEnd, description, location })
            }
            // Advance by interval weeks
            cur.setDate(cur.getDate() + 7 * interval)
          }
        } else {
          // Non-recurring or unsupported recurrence — store as single event
          events.push({ uid, title, start_time: startIso, end_time: endIso, description, location })
        }
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
          current[`_${baseKey}_FULL`] = `${key}:${val}`
        } else if (baseKey === 'EXDATE') {
          // Accumulate multiple EXDATE lines
          current['EXDATE'] = current['EXDATE'] ? current['EXDATE'] + ',' + val : val
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
