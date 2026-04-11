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

  // Normalize webcal:// → https://
  let normalizedUrl = url.trim().replace(/^webcal:\/\//i, "https://");

  // Outlook / OWA: swap .html suffix → .ics (common mistake when copying the web view URL)
  // e.g. https://outlook.office365.com/owa/calendar/.../calendar.html → calendar.ics
  normalizedUrl = normalizedUrl.replace(/\/calendar\.html(\?.*)?$/, "/calendar.ics$1");
  normalizedUrl = normalizedUrl.replace(/\/reachcalendar\.html(\?.*)?$/, "/reachcalendar.ics$1");

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
      signal: AbortSignal.timeout(30_000),
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

// ─── iCal parser with RRULE expansion ───────────────────────────────────────
type ParsedEvent = { uid: string; title: string; start_time: string; end_time: string; description: string | null; location: string | null };

const DAY_MAP: Record<string, number> = { MO:0, TU:1, WE:2, TH:3, FR:4, SA:5, SU:6 };

function parseIcalDate(val: string): Date {
  const v = val.replace(/^[^:]*:/, "").trim();
  if (v.length === 8) return new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T00:00:00Z`);
  const iso = `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}${v.endsWith("Z")?"Z":"Z"}`;
  return new Date(iso);
}

function expandRrule(dtstart: Date, duration: number, rruleStr: string, exdates: Set<string>): Array<[Date, Date]> {
  if (!rruleStr) return [];
  const parts: Record<string, string> = {};
  for (const p of rruleStr.split(";")) { const [k,v] = p.split("="); if (k && v) parts[k] = v; }
  const freq = parts["FREQ"] ?? "";
  const interval = parseInt(parts["INTERVAL"] ?? "1");
  const byday = (parts["BYDAY"] ?? "").split(",").map(d => DAY_MAP[d]).filter(n => n !== undefined);
  let until: Date | null = null;
  let count: number | null = null;
  if (parts["UNTIL"]) { try { until = parseIcalDate(parts["UNTIL"]); } catch {} }
  if (parts["COUNT"]) count = parseInt(parts["COUNT"]);
  if (!until && !count) until = new Date(dtstart.getTime() + 730 * 86400000); // 2yr default

  const results: Array<[Date, Date]> = [];
  let current = new Date(dtstart);
  let n = 0, maxIter = 1000;

  while (maxIter-- > 0) {
    if (until && current > until) break;
    if (count !== null && n >= count) break;
    const dayOk = byday.length === 0 || byday.includes(current.getUTCDay() === 0 ? 6 : current.getUTCDay() - 1);
    const dateKey = current.toISOString().slice(0, 10);
    if (dayOk && !exdates.has(dateKey)) {
      results.push([current, new Date(current.getTime() + duration)]);
      n++;
    }
    // Advance
    if (freq === "DAILY") {
      current = new Date(current.getTime() + interval * 86400000);
    } else if (freq === "WEEKLY") {
      if (byday.length > 0) {
        // Move to next day, find next matching weekday within weekly interval
        let next = new Date(current.getTime() + 86400000);
        let tries = 0;
        while (tries++ < 14 * interval) {
          const wd = next.getUTCDay() === 0 ? 6 : next.getUTCDay() - 1;
          const weeksDiff = Math.floor((next.getTime() - dtstart.getTime()) / (7 * 86400000));
          if (byday.includes(wd) && weeksDiff % interval === 0) break;
          next = new Date(next.getTime() + 86400000);
        }
        current = next;
      } else {
        current = new Date(current.getTime() + interval * 7 * 86400000);
      }
    } else if (freq === "MONTHLY") {
      const m = current.getUTCMonth() + interval;
      current = new Date(Date.UTC(current.getUTCFullYear() + Math.floor(m / 12), m % 12, current.getUTCDate(), current.getUTCHours(), current.getUTCMinutes()));
    } else break;
  }
  return results;
}

function parseIcal(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  // Unfold continuation lines
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const l of raw) {
    if (l && /^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1);
    else lines.push(l);
  }

  let inEvent = false;
  let cur: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; cur = {}; continue; }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (!cur["UID"]) continue;
      const uid = cur["UID"];
      const title = (cur["SUMMARY"] ?? "").replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "").trim();
      const location = cur["LOCATION"] ? cur["LOCATION"].replace(/\\,/g, ",").trim() : null;
      const description = cur["DESCRIPTION"] ? cur["DESCRIPTION"].replace(/\\n/g, "\n").replace(/\\,/g, ",").trim() : null;
      const startRaw = cur["DTSTART"] ?? "";
      const endRaw = cur["DTEND"] ?? startRaw;
      if (!startRaw) continue;

      let dtstart: Date, dtend: Date;
      try { dtstart = parseIcalDate(startRaw); dtend = endRaw ? parseIcalDate(endRaw) : new Date(dtstart.getTime() + 3600000); }
      catch { continue; }
      const duration = dtend.getTime() - dtstart.getTime();

      // Collect EXDATE
      const exdates = new Set<string>();
      for (const [k, v] of Object.entries(cur)) {
        if (k.startsWith("EXDATE")) {
          for (const ex of v.split(",")) { try { exdates.add(parseIcalDate(ex.trim()).toISOString().slice(0, 10)); } catch {} }
        }
      }

      const rrule = cur["RRULE"] ?? "";
      if (rrule) {
        const occurrences = expandRrule(dtstart, duration, rrule, exdates);
        occurrences.forEach(([s, e], i) => {
          events.push({ uid: `${uid}::r${i}`, title: title || "Untitled", start_time: s.toISOString(), end_time: e.toISOString(), description, location });
        });
      } else if (!exdates.has(dtstart.toISOString().slice(0, 10))) {
        events.push({ uid, title: title || "Untitled", start_time: dtstart.toISOString(), end_time: dtend.toISOString(), description, location });
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
    if (rawKey !== baseKey) cur[rawKey] = val; // keep DTSTART;TZID=... etc
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
