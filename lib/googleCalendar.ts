export type CalendarEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: Array<{ email: string; displayName?: string }>
  htmlLink?: string
}

/**
 * Fetch events for a specific date (YYYY-MM-DD).
 * If no date is provided, falls back to today in UTC (avoid this — always pass date from client).
 */
export async function getEventsForDate(
  accessToken: string,
  dateStr?: string,
  calendarId = 'primary'
): Promise<CalendarEvent[]> {
  let startOfDay: Date
  let endOfDay: Date

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Parse the client-provided date as local midnight → use T00:00:00 and T23:59:59 in that date string directly
    startOfDay = new Date(`${dateStr}T00:00:00`)
    endOfDay = new Date(`${dateStr}T23:59:59`)
  } else {
    // Fallback: server UTC date
    const now = new Date()
    startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
  }

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
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

// Keep backward-compat alias
export async function getTodayEvents(
  accessToken: string,
  calendarId = 'primary'
): Promise<CalendarEvent[]> {
  return getEventsForDate(accessToken, undefined, calendarId)
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
