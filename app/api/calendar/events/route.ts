import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getTodayEvents } from "@/lib/googleCalendar";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated", events: [] }, { status: 401 });
  }

  if (!session.accessToken) {
    // Logged in but no calendar token — likely old session before scope was added
    return NextResponse.json({ error: "No calendar access token. Please sign out and sign in again.", events: [], needsReauth: true }, { status: 403 });
  }

  try {
    const events = await getTodayEvents(session.accessToken);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('[calendar/events] Error fetching events:', err);
    return NextResponse.json({ error: "Failed to fetch events", events: [] }, { status: 500 });
  }
}
