export type CalendarEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: Array<{ email: string; displayName?: string }>
  htmlLink?: string
  calendarId?: string
}

export type CalendarError = { error: string; status: number }

export async function listCalendars(
  accessToken: string
): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

/**
 * Compute UTC start/end of a calendar day in a given IANA timezone.
 * e.g. "2026-04-06" in "America/New_York" → [2026-04-06T04:00:00Z, 2026-04-07T03:59:59.999Z]
 */
function getDayBoundsInTz(dateStr: string, tz: string): { start: Date; end: Date } {
  try {
    const noon = new Date(`${dateStr}T12:00:00Z`)
    const tzStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(noon)
    const noonLocalAsUTC = new Date(tzStr.replace(', ', 'T').replace(' ', 'T') + 'Z')
    const offsetMs = noon.getTime() - noonLocalAsUTC.getTime()
    const midnight = new Date(`${dateStr}T00:00:00Z`)
    const start = new Date(midnight.getTime() + offsetMs)
    const end = new Date(start.getTime() + 86_400_000 - 1)
    return { start, end }
  } catch {
    return {
      start: new Date(`${dateStr}T00:00:00Z`),
      end: new Date(`${dateStr}T23:59:59.999Z`),
    }
  }
}

/**
 * Fetch events from a single calendar for a given time range.
 */
export async function getEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime' })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) {
    console.error(`[googleCalendar] getEventsForCalendar(${calendarId}) failed:`, res.status)
    return []
  }
  const data = await res.json()
  return ((data.items ?? []) as CalendarEvent[]).map((e) => ({ ...e, calendarId }))
}

/**
 * Fetch ALL calendars' events for a date (YYYY-MM-DD) in the user's IANA timezone.
 * Merges, deduplicates by event ID, and sorts by start time.
 * Returns CalendarError if the token is invalid/expired.
 */
export async function getEventsForDate(
  accessToken: string,
  dateStr?: string,
  tz?: string
): Promise<CalendarEvent[] | CalendarError> {
  // First validate the token by fetching calendars — this will 401 if expired
  const calendars = await listCalendars(accessToken)

  // Compute time bounds
  let start: Date, end: Date
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && tz) {
    ;({ start, end } = getDayBoundsInTz(dateStr, tz))
  } else if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    start = new Date(`${dateStr}T00:00:00Z`)
    end = new Date(`${dateStr}T23:59:59.999Z`)
  } else {
    const today = new Date().toISOString().split('T')[0]
    start = new Date(`${today}T00:00:00Z`)
    end = new Date(`${today}T23:59:59.999Z`)
  }

  const timeMin = start.toISOString()
  const timeMax = end.toISOString()

  // Validate token with a test call
  const testRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!testRes.ok) {
    const body = await testRes.text()
    console.error('[googleCalendar] Token validation failed:', testRes.status, body)
    return { error: `Google API error ${testRes.status}`, status: testRes.status }
  }

  // Fetch all calendars in parallel
  const calendarIds = calendars.length > 0 ? calendars.map((c) => c.id) : ['primary']
  const allResults = await Promise.all(
    calendarIds.map((id) => getEventsForCalendar(accessToken, id, timeMin, timeMax))
  )

  // Merge, deduplicate by event ID, sort by start
  const seen = new Set<string>()
  const merged: CalendarEvent[] = []
  for (const events of allResults) {
    for (const event of events) {
      if (!seen.has(event.id)) {
        seen.add(event.id)
        merged.push(event)
      }
    }
  }

  merged.sort((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? ''
    const bTime = b.start.dateTime ?? b.start.date ?? ''
    return aTime.localeCompare(bTime)
  })

  return merged
}

// Backward-compat
export async function getTodayEvents(
  accessToken: string,
  calendarId?: string
): Promise<CalendarEvent[] | CalendarError> {
  if (calendarId) {
    const now = new Date()
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0)
    const timeMax = new Date(now); timeMax.setHours(23, 59, 59, 999)
    return getEventsForCalendar(accessToken, calendarId, timeMin.toISOString(), timeMax.toISOString())
  }
  return getEventsForDate(accessToken)
}

export async function createEvent(
  accessToken: string,
  event: Partial<CalendarEvent>,
  calendarId = 'primary'
): Promise<CalendarEvent | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  )
  if (!res.ok) return null
  return res.json() as Promise<CalendarEvent>
}
