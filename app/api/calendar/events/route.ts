import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getEventsForDate } from "@/lib/googleCalendar";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated", events: [] }, { status: 401 });
  }

  // Token refresh failed — user must re-auth
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({
      error: "Session expired. Please sign out and sign in again.",
      events: [],
      needsReauth: true,
    }, { status: 403 });
  }

  if (!session.accessToken) {
    return NextResponse.json({
      error: "No calendar access token. Please sign out and sign in again.",
      events: [],
      needsReauth: true,
    }, { status: 403 });
  }

  const dateParam = req.nextUrl.searchParams.get('date') ?? undefined;
  const tzParam = req.nextUrl.searchParams.get('tz') ?? undefined;

  const result = await getEventsForDate(session.accessToken, dateParam, tzParam);

  if ('error' in result) {
    // Token expired at Google API level — prompt re-auth
    if (result.status === 401) {
      return NextResponse.json({
        error: "Google Calendar token expired. Please sign out and sign in again.",
        events: [],
        needsReauth: true,
      }, { status: 403 });
    }
    return NextResponse.json({ error: result.error, events: [] }, { status: 500 });
  }

  return NextResponse.json({ events: result });
}
