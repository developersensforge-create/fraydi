import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getEventsForDate } from "@/lib/googleCalendar";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated", events: [] }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({
      error: "No calendar access token. Please sign out and sign in again.",
      events: [],
      needsReauth: true,
    }, { status: 403 });
  }

  // Client sends local date (YYYY-MM-DD) and IANA timezone (e.g. "America/New_York")
  const dateParam = req.nextUrl.searchParams.get('date') ?? undefined;
  const tzParam = req.nextUrl.searchParams.get('tz') ?? undefined;

  try {
    const events = await getEventsForDate(session.accessToken, dateParam, tzParam);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('[calendar/events] Error fetching events:', err);
    return NextResponse.json({ error: "Failed to fetch events", events: [] }, { status: 500 });
  }
}
