/**
 * /api/user/events
 * Unified event feed: merges Google Calendar events + imported iCal events.
 * Each event carries its source calendar's color and name.
 * Query params: ?date=YYYY-MM-DD&tz=America/New_York
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getEventsForDate } from "@/lib/googleCalendar";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function supa(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
}

export type UnifiedEvent = {
  id: string;
  title: string;
  start: string;       // ISO string
  end: string;         // ISO string
  isAllDay: boolean;
  location?: string;
  description?: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  source: "google" | "ical";
  htmlLink?: string;
};

/** Compute UTC start/end of a calendar day in a given IANA timezone */
function getDayBounds(dateStr: string, tz: string): { start: Date; end: Date } {
  try {
    const noon = new Date(`${dateStr}T12:00:00Z`);
    const tzStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(noon);
    const noonLocal = new Date(tzStr.replace(", ", "T").replace(" ", "T") + "Z");
    const offsetMs = noon.getTime() - noonLocal.getTime();
    const midnight = new Date(`${dateStr}T00:00:00Z`);
    const start = new Date(midnight.getTime() + offsetMs);
    const end = new Date(start.getTime() + 86_400_000 - 1);
    return { start, end };
  } catch {
    return { start: new Date(`${dateStr}T00:00:00Z`), end: new Date(`${dateStr}T23:59:59Z`) };
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Session expired", needsReauth: true, events: [] }, { status: 403 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: "No calendar token", needsReauth: true, events: [] }, { status: 403 });
  }

  const dateParam = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const tz = req.nextUrl.searchParams.get("tz") ?? "UTC";
  const email = session.user?.email ?? "";

  const { start: dayStart, end: dayEnd } = getDayBounds(dateParam, tz);

  // ── 1. Google Calendar events ──────────────────────────────────────────────
  const [y, m, d] = dateParam.split('-').map(Number)
  const googleResult = await getEventsForDate(session.accessToken, new Date(y, m - 1, d, 12, 0, 0));
  const googleEvents: UnifiedEvent[] = [];

  if (!("error" in googleResult)) {
    // Get calendar list + user prefs for color/name/visibility
    const [calListRes, prefsRes] = await Promise.all([
      fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }),
      supa(`/user_google_cal_prefs?user_email=eq.${encodeURIComponent(email)}`),
    ]);
    const calListData = calListRes.ok ? await calListRes.json() : { items: [] };
    const prefs: Array<{ google_calendar_id: string; display_name?: string; color?: string; visible: boolean }> =
      prefsRes.ok ? await prefsRes.json() : [];
    const prefMap = new Map(prefs.map(p => [p.google_calendar_id, p]));

    const calMap: Record<string, { name: string; color: string; visible: boolean }> = {};
    for (const cal of calListData.items ?? []) {
      const pref = prefMap.get(cal.id);
      calMap[cal.id] = {
        name: pref?.display_name ?? cal.summary ?? "Google Calendar",
        color: pref?.color ?? cal.backgroundColor ?? "#4285F4",
        visible: pref?.visible ?? true,
      };
    }

    for (const ev of googleResult) {
      const isAllDay = !ev.start.dateTime;
      const start = ev.start.dateTime ?? ev.start.date ?? "";
      const end = ev.end.dateTime ?? ev.end.date ?? "";
      const calId = ev.calendarId ?? "primary";
      const calInfo = calMap[calId] ?? { name: "Google Calendar", color: "#4285F4", visible: true };
      // Skip hidden calendars
      if (!calInfo.visible) continue;
      googleEvents.push({
        id: `google::${ev.id}`,
        title: ev.summary || "Untitled",
        start,
        end,
        isAllDay,
        description: ev.description,
        calendarId: calId,
        calendarName: calInfo.name,
        calendarColor: calInfo.color,
        source: "google",
        htmlLink: ev.htmlLink,
      });
    }
  }

  // ── 2. Imported iCal events ────────────────────────────────────────────────
  // Get active calendar sources for this user
  const sourcesRes = await supa(
    `/calendar_sources?user_email=eq.${encodeURIComponent(email)}&active=eq.true&select=id,name,color`
  );
  const sources: Array<{ id: string; name: string; color: string }> =
    sourcesRes.ok ? await sourcesRes.json() : [];

  const icalEvents: UnifiedEvent[] = [];

  if (sources.length > 0) {
    const sourceIds = sources.map((s) => s.id);
    const sourceMap: Record<string, { name: string; color: string }> = {};
    for (const s of sources) sourceMap[s.id] = { name: s.name, color: s.color };

    // Fetch events for those sources in the date window
    const eventsRes = await supa(
      `/calendar_events?calendar_source_id=in.(${sourceIds.map((id) => id).join(",")})` +
      `&start_time=gte.${dayStart.toISOString()}&start_time=lte.${dayEnd.toISOString()}` +
      `&order=start_time.asc&select=id,title,start_time,end_time,location,description,calendar_source_id`
    );
    const rows: Array<{
      id: string; title: string; start_time: string; end_time: string;
      location?: string; description?: string; calendar_source_id: string;
    }> = eventsRes.ok ? await eventsRes.json() : [];

    for (const row of rows) {
      const calInfo = sourceMap[row.calendar_source_id] ?? { name: "Imported", color: "#6366f1" };
      // All-day if time is exactly midnight UTC
      const isAllDay = row.start_time?.endsWith("T00:00:00+00:00") || row.start_time?.endsWith("T00:00:00Z");
      icalEvents.push({
        id: `ical::${row.id}`,
        title: row.title || "Untitled",
        start: row.start_time,
        end: row.end_time,
        isAllDay,
        location: row.location,
        description: row.description,
        calendarId: row.calendar_source_id,
        calendarName: calInfo.name,
        calendarColor: calInfo.color,
        source: "ical",
      });
    }
  }

  // ── 3. Merge & sort ─────────────────────────────────────────────────────────
  const all = [...googleEvents, ...icalEvents];
  all.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.start.localeCompare(b.start);
  });

  // ── 4. Calendar source list for legend/toggles ──────────────────────────────
  const calendarSources = [
    // Google calendars actually used
    ...new Map(
      googleEvents.map((e) => [e.calendarId, { id: e.calendarId, name: e.calendarName, color: e.calendarColor, source: "google" as const }])
    ).values(),
    // Imported calendars
    ...sources.map((s) => ({ id: s.id, name: s.name, color: s.color, source: "ical" as const })),
  ];

  return NextResponse.json({
    events: all,
    calendarSources,
    googleCount: googleEvents.length,
    icalCount: icalEvents.length,
  });
}
