/**
 * /api/user/calendars
 * User-scoped calendar sources — no family_id required.
 * Scoped by session email so each user sees their own calendars.
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function supa(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options?.headers ?? {}),
    },
  });
}

// GET /api/user/calendars — list this user's calendar sources
export async function GET() {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const email = session.user.email;
  const res = await supa(
    `/calendar_sources?user_email=eq.${encodeURIComponent(email)}&order=created_at.asc`
  );
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const data = await res.json();
  return NextResponse.json({ calendars: data });
}

// POST /api/user/calendars — add a new calendar source and import events
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const email = session.user.email;
  const { name, url, color } = await req.json();

  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  // Normalize webcal://
  const normalizedUrl = url.trim().replace(/^webcal:\/\//i, "https://");

  // Check for duplicate
  const checkRes = await supa(
    `/calendar_sources?user_email=eq.${encodeURIComponent(email)}&ical_url=eq.${encodeURIComponent(normalizedUrl)}`
  );
  const existing = await checkRes.json();
  if (existing.length > 0) {
    return NextResponse.json({ error: "This calendar URL is already added." }, { status: 409 });
  }

  // Insert the source
  const insertRes = await supa("/calendar_sources", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      ical_url: normalizedUrl,
      color: color || "#f96400",
      user_email: email,
      event_count: 0,
    }),
  });

  if (!insertRes.ok) {
    return NextResponse.json({ error: await insertRes.text() }, { status: 500 });
  }
  const [source] = await insertRes.json();

  // Fetch and parse the iCal feed
  let eventCount = 0;
  let importError = null;
  try {
    const feedRes = await fetch(normalizedUrl, {
      headers: { "User-Agent": "Fraydi/1.0 Calendar Importer" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!feedRes.ok) throw new Error(`HTTP ${feedRes.status}`);
    const icalText = await feedRes.text();
    const events = parseIcal(icalText);
    eventCount = events.length;

    if (events.length > 0) {
      const rows = events.map((ev) => ({
        user_email: email,
        calendar_source_id: source.id,
        google_event_id: `${source.id}::${ev.uid}`,
        title: ev.title,
        description: ev.description,
        start_time: ev.start_time,
        end_time: ev.end_time,
        location: ev.location,
        is_child_event: false,
        requires_coverage: false,
        assignment_confirmed: false,
        family_id: null,
        profile_id: null,
      }));

      // Upsert events in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        await supa("/calendar_events", {
          method: "POST",
          headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows.slice(i, i + 500)),
        });
      }
    }

    // Update event_count and last_synced_at on the source
    await supa(`/calendar_sources?id=eq.${source.id}`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ event_count: eventCount, last_synced_at: new Date().toISOString() }),
    });
    source.event_count = eventCount;
    source.last_synced_at = new Date().toISOString();
  } catch (err) {
    importError = (err as Error).message;
  }

  return NextResponse.json({ calendar: source, imported: eventCount, importError });
}

// DELETE /api/user/calendars?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const email = session.user.email;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Delete associated events first
  await supa(`/calendar_events?calendar_source_id=eq.${id}&user_email=eq.${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: { "Prefer": "return=minimal" },
  });

  // Delete the source
  const res = await supa(
    `/calendar_sources?id=eq.${id}&user_email=eq.${encodeURIComponent(email)}`,
    { method: "DELETE", headers: { "Prefer": "return=minimal" } }
  );
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ─── iCal parser ────────────────────────────────────────────────
function parseIcal(text: string) {
  const events: Array<{ uid: string; title: string; start_time: string; end_time: string; description: string | null; location: string | null }> = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let inEvent = false;
  let cur: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    // Unfold continuation lines
    let line = lines[i];
    while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
      line += lines[++i].slice(1);
    }

    if (line === "BEGIN:VEVENT") { inEvent = true; cur = {}; continue; }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur["UID"]) {
        const parseDate = (val: string): string => {
          const v = val.replace(/^[^:]*:/, "");
          if (v.length === 8) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T00:00:00Z`;
          const y=v.slice(0,4),mo=v.slice(4,6),d=v.slice(6,8),h=v.slice(9,11),mi=v.slice(11,13),s=v.slice(13,15);
          return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${v.endsWith("Z")?"Z":"Z"}`).toISOString();
        };
        const startRaw = cur["DTSTART"] || "";
        const endRaw = cur["DTEND"] || startRaw;
        events.push({
          uid: cur["UID"],
          title: (cur["SUMMARY"] || "Untitled").replace(/\\,/g,",").replace(/\\n/g," ").replace(/\\/g,""),
          start_time: startRaw ? parseDate(startRaw) : new Date().toISOString(),
          end_time: endRaw ? parseDate(endRaw) : new Date().toISOString(),
          description: cur["DESCRIPTION"] ? cur["DESCRIPTION"].replace(/\\n/g,"\n").replace(/\\,/g,",") : null,
          location: cur["LOCATION"] ? cur["LOCATION"].replace(/\\,/g,",") : null,
        });
      }
      continue;
    }
    if (!inEvent) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const rawKey = line.slice(0, colon).toUpperCase();
    const val = line.slice(colon + 1);
    const baseKey = rawKey.split(";")[0];
    cur[baseKey] = val;
    if (["DTSTART","DTEND"].includes(baseKey)) cur[rawKey] = val;
  }
  return events;
}

// PATCH /api/user/calendars?id=xxx — update active, name, color
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const email = session.user.email;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await req.json();
  // Only allow safe fields to be updated
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.color === "string" && body.color) patch.color = body.color;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const res = await supa(`/calendar_sources?id=eq.${id}&user_email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const [updated] = await res.json();
  return NextResponse.json({ calendar: updated });
}
