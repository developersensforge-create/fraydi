export type CalendarEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: Array<{ email: string; displayName?: string }>
  htmlLink?: string
}

/**
 * Compute the UTC start/end of a calendar day in a given IANA timezone.
 * e.g. "2026-04-06" in "America/New_York" → [2026-04-06T04:00:00Z, 2026-04-07T03:59:59.999Z]
 */
function getDayBoundsInTz(dateStr: string, tz: string): { start: Date; end: Date } {
  try {
    // Use noon UTC on that date as a stable anchor (avoids DST-transition edge cases at midnight)
    const noon = new Date(`${dateStr}T12:00:00Z`)

    // Format noon UTC as a local time string in the target timezone
    const tzStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(noon) // → "2026-04-06, 08:00:00" (UTC-4) or "2026-04-06 08:00:00"

    // Parse back as UTC to compute the offset
    const noonLocalAsUTC = new Date(tzStr.replace(', ', 'T').replace(' ', 'T') + 'Z')
    const offsetMs = noon.getTime() - noonLocalAsUTC.getTime()
    // e.g. UTC-4: noon(UTC) - noon(local parsed as UTC) = 12:00Z - 08:00Z = +4h

    // Apply offset to midnight UTC → get midnight in the target timezone
    const midnight = new Date(`${dateStr}T00:00:00Z`)
    const start = new Date(midnight.getTime() + offsetMs)
    const end = new Date(start.getTime() + 86_400_000 - 1) // start + 24h - 1ms
    return { start, end }
  } catch {
    // Fallback: treat as UTC
    return {
      start: new Date(`${dateStr}T00:00:00Z`),
      end: new Date(`${dateStr}T23:59:59.999Z`),
    }
  }
}

/**
 * Fetch events for a specific date (YYYY-MM-DD) in the user's IANA timezone.
 * Pass both `dateStr` and `tz` from the client so the server always uses
 * the user's device timezone regardless of where the server runs.
 */
export async function getEventsForDate(
  accessToken: string,
  dateStr?: string,
  tz?: string,
  calendarId = 'primary'
): Promise<CalendarEvent[]> {
  let start: Date, end: Date

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && tz) {
    ;({ start, end } = getDayBoundsInTz(dateStr, tz))
  } else if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Date but no tz — treat as UTC
    start = new Date(`${dateStr}T00:00:00Z`)
    end = new Date(`${dateStr}T23:59:59.999Z`)
  } else {
    // No date — use current UTC day as last resort
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    start = new Date(`${today}T00:00:00Z`)
    end = new Date(`${today}T23:59:59.999Z`)
  }

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    console.error('[googleCalendar] getEventsForDate failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.items ?? []) as CalendarEvent[]
}

// Backward-compat
export async function getTodayEvents(
  accessToken: string,
  calendarId = 'primary'
): Promise<CalendarEvent[]> {
  return getEventsForDate(accessToken, undefined, undefined, calendarId)
}

export async function listCalendars(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

export async function createEvent(
  accessToken: string,
  event: Partial<CalendarEvent>,
  calendarId = 'primary'
) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )
  if (!res.ok) return null
  return res.json() as Promise<CalendarEvent>
}
