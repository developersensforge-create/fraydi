/**
 * Google Calendar API helper (stub)
 *
 * TODO: Install `googleapis` and wire up OAuth 2.0 via next-auth
 *
 * Setup steps:
 * 1. Create a project in Google Cloud Console
 * 2. Enable the Google Calendar API
 * 3. Create OAuth 2.0 credentials → add to .env.local:
 *      GOOGLE_CLIENT_ID=...
 *      GOOGLE_CLIENT_SECRET=...
 * 4. Add redirect URI: http://localhost:3000/api/auth/callback/google
 * 5. Replace the stubs below with real googleapis calls
 */

export type CalendarEvent = {
  id: string
  summary: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  attendees?: Array<{ email: string; displayName?: string }>
  htmlLink?: string
}

/**
 * Fetch today's events for an authenticated user.
 * @param accessToken - OAuth 2.0 access token from next-auth session
 * @param calendarId  - Calendar ID (default: 'primary')
 */
export async function getTodayEvents(
  _accessToken: string,
  _calendarId = 'primary'
): Promise<CalendarEvent[]> {
  // STUB — replace with real implementation
  console.log('[googleCalendar] getTodayEvents called — not yet implemented')

  // Example implementation once googleapis is wired:
  // const { google } = await import('googleapis')
  // const oauth2Client = new google.auth.OAuth2()
  // oauth2Client.setCredentials({ access_token: accessToken })
  // const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  // const now = new Date()
  // const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString()
  // const endOfDay   = new Date(now.setHours(23, 59, 59, 999)).toISOString()
  // const res = await calendar.events.list({
  //   calendarId,
  //   timeMin: startOfDay,
  //   timeMax: endOfDay,
  //   singleEvents: true,
  //   orderBy: 'startTime',
  // })
  // return (res.data.items ?? []) as CalendarEvent[]

  return []
}

/**
 * Create a new event on the user's calendar.
 * @param accessToken - OAuth 2.0 access token
 * @param event       - Event details
 */
export async function createEvent(
  _accessToken: string,
  _event: Partial<CalendarEvent>
): Promise<CalendarEvent | null> {
  // STUB — replace with real implementation
  console.log('[googleCalendar] createEvent called — not yet implemented')
  return null
}

/**
 * List all calendars accessible to the authenticated user.
 * @param accessToken - OAuth 2.0 access token
 */
export async function listCalendars(
  _accessToken: string
): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  // STUB — replace with real implementation
  console.log('[googleCalendar] listCalendars called — not yet implemented')
  return []
}
