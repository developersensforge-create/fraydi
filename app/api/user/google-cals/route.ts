/**
 * /api/user/google-cals
 * Manage per-user display preferences for Google Calendar sub-calendars.
 * GET  — list all Google calendars with user prefs merged in
 * POST — upsert prefs (display_name, color, visible) for a specific calendar
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function supa(path: string, opts?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(opts?.headers ?? {}),
    },
  });
}

// GET — fetch Google calendar list + merge user prefs
export async function GET() {
  const session = await getServerSession(authOptions) as any;
  if (!session?.accessToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const email = session.user?.email ?? "";

  // Fetch from Google
  const gRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,backgroundColor,primary,selected)", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!gRes.ok) return NextResponse.json({ error: "Failed to fetch Google calendars" }, { status: 502 });
  const { items = [] } = await gRes.json();

  // Fetch stored prefs
  const pRes = await supa(`/user_google_cal_prefs?user_email=eq.${encodeURIComponent(email)}`);
  const prefs: Array<{ google_calendar_id: string; display_name?: string; color?: string; visible: boolean }> =
    pRes.ok ? await pRes.json() : [];
  const prefMap = new Map(prefs.map(p => [p.google_calendar_id, p]));

  // Merge
  const calendars = items.map((cal: { id: string; summary: string; backgroundColor: string; primary?: boolean }) => {
    const pref = prefMap.get(cal.id);
    return {
      id: cal.id,
      summary: cal.summary,
      googleColor: cal.backgroundColor ?? "#4285F4",
      primary: cal.primary ?? false,
      // User overrides
      displayName: pref?.display_name ?? cal.summary,
      color: pref?.color ?? cal.backgroundColor ?? "#4285F4",
      visible: pref?.visible ?? true,
    };
  });

  return NextResponse.json({ calendars });
}

// POST — upsert pref for one Google calendar
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const email = session.user.email;
  const { google_calendar_id, display_name, color, visible } = await req.json();
  if (!google_calendar_id) return NextResponse.json({ error: "google_calendar_id required" }, { status: 400 });

  const payload: Record<string, unknown> = { user_email: email, google_calendar_id };
  if (display_name !== undefined) payload.display_name = display_name;
  if (color !== undefined) payload.color = color;
  if (visible !== undefined) payload.visible = visible;

  const res = await supa("/user_google_cal_prefs", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const [row] = await res.json();
  return NextResponse.json({ pref: row });
}
