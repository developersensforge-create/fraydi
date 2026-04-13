export type CalendarEvent = {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: Array<{ email: string; displayName?: string }>
  htmlLink?: string
  calendarId?: string
  colorId?: string
  status?: string
}

export async function listCalendars(accessToken: string): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

/**
 * Fetch events from a single calendar for a given date range.
 */
export async function getEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  })

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
 * Fetch ALL calendars' events for a date, merged and deduplicated by event ID.
 * Pass explicit timeMin/timeMax (timezone-aware) to avoid server UTC midnight bug.
 */
export async function getEventsForDate(
  accessToken: string,
  date: Date,
  explicitTimeMin?: Date,
  explicitTimeMax?: Date
): Promise<CalendarEvent[]> {
  // Use explicit bounds if provided (timezone-correct); fall back to UTC midnight (legacy)
  const timeMin = explicitTimeMin ?? (() => { const d = new Date(date); d.setHours(0,0,0,0); return d })()
  const timeMax = explicitTimeMax ?? (() => { const d = new Date(date); d.setHours(23,59,59,999); return d })()

  const calendars = await listCalendars(accessToken)
  if (!calendars.length) {
    // Fallback to primary
    return getEventsForCalendar(accessToken, 'primary', timeMin.toISOString(), timeMax.toISOString())
  }

  const allResults = await Promise.all(
    calendars.map((cal) =>
      getEventsForCalendar(accessToken, cal.id, timeMin.toISOString(), timeMax.toISOString())
    )
  )

  // Flatten, deduplicate by event ID, sort by start time
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
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0
  })

  return merged
}

/**
 * Legacy: fetch today's events. Uses multi-calendar if no calendarId specified.
 */
export async function getTodayEvents(
  accessToken: string,
  calendarId?: string
): Promise<CalendarEvent[]> {
  const now = new Date()
  if (calendarId) {
    const timeMin = new Date(now)
    timeMin.setHours(0, 0, 0, 0)
    const timeMax = new Date(now)
    timeMax.setHours(23, 59, 59, 999)
    return getEventsForCalendar(accessToken, calendarId, timeMin.toISOString(), timeMax.toISOString())
  }
  return getEventsForDate(accessToken, now)
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
