/**
 * Lightweight iCal parser — parses VEVENT blocks from iCal text.
 * Shared between import, sync, and cron routes.
 */

export interface ParsedEvent {
  uid: string
  title: string
  start_time: string
  end_time: string
  description: string | null
  location: string | null
}

function parseIcalDate(val: string): string {
  // Strip params like TZID=America/New_York: prefix
  const v = val.includes(':') ? val.split(':').slice(1).join(':') : val

  if (v.length === 8) {
    // All-day date: YYYYMMDD
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`
  }

  // DATE-TIME: 20240101T120000Z or 20240101T120000
  const y = v.slice(0, 4)
  const mo = v.slice(4, 6)
  const d = v.slice(6, 8)
  const h = v.slice(9, 11)
  const mi = v.slice(11, 13)
  const s = v.slice(13, 15)
  const utc = v.endsWith('Z') ? 'Z' : 'Z'

  try {
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${utc}`).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function unescape(val: string): string {
  return val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\/g, '')
}

export function parseIcal(icalText: string): ParsedEvent[] {
  const events: ParsedEvent[] = []
  const lines = icalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Unfold continuation lines (lines starting with space/tab continue previous line)
  const unfolded: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }

  let inEvent = false
  let current: Record<string, string> = {}

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
    } else if (line === 'END:VEVENT') {
      inEvent = false
      if (current['UID']) {
        const startRaw = current['DTSTART'] || ''
        const endRaw = current['DTEND'] || startRaw

        events.push({
          uid: current['UID'],
          title: unescape(current['SUMMARY'] || 'Untitled'),
          start_time: startRaw ? parseIcalDate(startRaw) : new Date().toISOString(),
          end_time: endRaw ? parseIcalDate(endRaw) : new Date().toISOString(),
          description: current['DESCRIPTION'] ? unescape(current['DESCRIPTION']) : null,
          location: current['LOCATION'] ? unescape(current['LOCATION']) : null,
        })
      }
    } else if (inEvent) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).toUpperCase()
        const val = line.slice(colonIdx + 1)
        const baseKey = key.split(';')[0]

        // For date fields, store both the full key (with params) and base key
        if (['DTSTART', 'DTEND'].includes(baseKey)) {
          current[key] = val
          current[baseKey] = line // store full line for param-aware parsing
        } else {
          current[baseKey] = val
        }
      }
    }
  }

  return events
}

export async function fetchAndParseIcal(icalUrl: string): Promise<ParsedEvent[]> {
  const normalizedUrl = icalUrl.replace(/^webcal:\/\//i, 'https://')

  const response = await fetch(normalizedUrl, {
    headers: { 'User-Agent': 'Fraydi/1.0 iCal Sync' },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching iCal URL`)
  }

  const text = await response.text()
  return parseIcal(text)
}
