"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
}

const COLORS: Record<string, string> = {
  "1": "#ac725e", "2": "#d06b64", "3": "#f83a22", "4": "#fa573c",
  "5": "#ff7537", "6": "#ffad46", "7": "#42d692", "8": "#16a765",
  "9": "#7bd148", "10": "#b3dc6c", "11": "#fbe983", "default": "#f96400",
};

function formatTime(dt?: string, d?: string) {
  if (dt) return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d) return "All day";
  return "";
}

function getNextEventCountdown(events: CalendarEvent[]): string {
  const now = new Date();
  const upcoming = events
    .filter((e) => e.start.dateTime && new Date(e.start.dateTime) > now)
    .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime());

  if (!upcoming.length) return "No upcoming events";

  const next = upcoming[0];
  const diff = new Date(next.start.dateTime!).getTime() - now.getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const title = next.summary || "Untitled";

  if (hours > 0) return `Next: ${title} in ${hours}h ${mins}m`;
  if (mins > 0) return `Next: ${title} in ${mins}m`;
  return `Next: ${title} — starting now`;
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ userName, userImage }: { userName?: string | null; userImage?: string | null }) {
  const navItems = [
    { label: "Calendar", active: true, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
    { label: "Family", active: false, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )},
    { label: "Calendars", active: false, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    )},
    { label: "Settings", active: false, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    )},
  ];

  return (
    <aside
      className="fixed left-0 top-0 h-full z-20 flex flex-col"
      style={{
        width: "64px",
        background: "#ffffff",
        borderRight: "1px solid #f0f0f0",
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 flex-shrink-0">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl font-black text-white text-xl select-none"
          style={{ background: "#f96400" }}
        >
          F
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-2 flex-1 pt-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            title={item.label}
            className="flex items-center justify-center rounded-xl p-2.5 transition-all duration-150 group relative"
            style={{
              background: item.active ? "#f96400" : "transparent",
              color: item.active ? "#ffffff" : "#9ca3af",
            }}
            onMouseEnter={(e) => {
              if (!item.active) (e.currentTarget as HTMLButtonElement).style.background = "#fff5ee";
            }}
            onMouseLeave={(e) => {
              if (!item.active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {item.icon}
            {/* Tooltip on mobile */}
            <span
              className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block lg:hidden"
              style={{ zIndex: 50 }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* User avatar */}
      <div className="flex flex-col items-center pb-4 flex-shrink-0">
        {userImage ? (
          <img src={userImage} alt={userName || "User"} className="w-8 h-8 rounded-full object-cover border-2 border-gray-100" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "#f96400" }}
          >
            {(userName || "U")[0].toUpperCase()}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 flex gap-3 animate-pulse"
      style={{ background: "#ffffff", border: "1px solid #f0f0f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="w-1 rounded-full flex-shrink-0 bg-gray-200" style={{ minHeight: "48px" }} />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  );
}

// ─── Right Panel ─────────────────────────────────────────────────────────────
function RightPanel({ events, loading }: { events: CalendarEvent[]; loading: boolean }) {
  const [shoppingItems, setShoppingItems] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addItem() {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    setShoppingItems((prev) => [...prev, trimmed]);
    setInputVal("");
  }

  const todayCount = events.length;
  const allDayCount = events.filter((e) => !e.start.dateTime).length;
  const timedCount = todayCount - allDayCount;
  const nextCountdown = loading ? "Loading…" : getNextEventCountdown(events);

  return (
    <aside
      className="hidden lg:flex flex-col gap-4 flex-shrink-0"
      style={{ width: "280px" }}
    >
      {/* Today at a glance */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "#ffffff", border: "1px solid #f0f0f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Today at a glance</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3 text-center" style={{ background: "#fff5ee" }}>
            <p className="text-2xl font-black" style={{ color: "#f96400" }}>{loading ? "–" : todayCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "#f8f9fa" }}>
            <p className="text-2xl font-black text-gray-700">{loading ? "–" : timedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Timed</p>
          </div>
        </div>

        {/* Next event */}
        <div className="rounded-xl p-3" style={{ background: "#f8f9fa" }}>
          <p className="text-xs text-gray-400 mb-1">⏰ Upcoming</p>
          <p className="text-sm font-medium text-gray-700 leading-snug">{nextCountdown}</p>
        </div>
      </div>

      {/* Quick shopping list */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: "#ffffff", border: "1px solid #f0f0f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Quick list</h3>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add item…"
            className="flex-1 text-sm px-3 py-2 rounded-lg outline-none border transition"
            style={{
              border: "1px solid #e5e7eb",
              fontSize: "14px",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#f96400")}
            onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
          />
          <button
            onClick={addItem}
            className="px-3 py-2 rounded-lg text-white text-sm font-semibold flex-shrink-0 transition-opacity hover:opacity-90"
            style={{ background: "#f96400" }}
          >
            +
          </button>
        </div>

        {shoppingItems.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Nothing yet — add something above</p>
        ) : (
          <ul className="space-y-1.5">
            {shoppingItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-2 group">
                <span className="text-sm text-gray-700 flex-1">{item}</span>
                <button
                  onClick={() => setShoppingItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-gray-300 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"today" | "week">("today");

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (session?.accessToken) {
      fetchCalendarEvents(session.accessToken as string);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  async function fetchCalendarEvents(accessToken: string) {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const timeMax = view === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        if (res.status === 401) {
          setError("Session expired. Please sign in again.");
          signIn("google");
          return;
        }
        setError(`Calendar error: ${res.status}`);
        return;
      }

      const data = await res.json();
      setEvents(data.items || []);
    } catch {
      setError("Could not load calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Auth loading ──
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fa" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#f96400", borderTopColor: "transparent" }} />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Unauthenticated ──
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fa" }}>
        <div className="text-center">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-2xl font-black text-white text-2xl mx-auto mb-4 select-none"
            style={{ background: "#f96400" }}
          >
            F
          </div>
          <p className="text-gray-600 mb-4">Sign in to view your calendar</p>
          <button
            onClick={() => signIn("google")}
            className="px-6 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#f96400" }}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen flex" style={{ background: "#f8f9fa" }}>
      {/* Sidebar */}
      <Sidebar userName={session?.user?.name} userImage={session?.user?.image} />

      {/* Main area — offset by sidebar width */}
      <div className="flex flex-1 min-w-0" style={{ marginLeft: "64px" }}>
        {/* Center content */}
        <div className="flex-1 flex flex-col min-w-0 max-w-3xl">
          {/* Top bar */}
          <header
            className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ background: "#f8f9fa", borderBottom: "1px solid #f0f0f0" }}
          >
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-none">
                {view === "today" ? "Today" : "This Week"}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{today}</p>
            </div>
            <div className="flex items-center gap-2">
              {(["today", "week"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    if (session?.accessToken) fetchCalendarEvents(session.accessToken as string);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={
                    view === v
                      ? { background: "#f96400", color: "#ffffff" }
                      : { background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb" }
                  }
                >
                  {v === "today" ? "Today" : "Week"}
                </button>
              ))}
              <button
                onClick={() => session?.accessToken && fetchCalendarEvents(session.accessToken as string)}
                title="Refresh"
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
                style={{ border: "1px solid #e5e7eb", background: "#ffffff", color: "#f96400" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>
          </header>

          {/* Events */}
          <main className="flex-1 px-6 py-5 overflow-y-auto">
            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : error ? (
              <div className="rounded-xl p-4 text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                {error}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">📅</span>
                <p className="text-gray-600 font-semibold text-lg mb-1">
                  No events {view === "today" ? "today" : "this week"}
                </p>
                <p className="text-gray-400 text-sm mb-4">Enjoy the free time!</p>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ color: "#f96400" }}
                >
                  Add a calendar →
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const color = COLORS[event.colorId ?? "default"] ?? COLORS["default"];
                  const startTime = formatTime(event.start.dateTime, event.start.date);
                  const endTime = formatTime(event.end.dateTime, event.end.date);
                  const isAllDay = !event.start.dateTime;
                  const eventDate = event.start.dateTime
                    ? new Date(event.start.dateTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                    : event.start.date;

                  return (
                    <div
                      key={event.id}
                      className="flex gap-0 rounded-xl overflow-hidden transition-all duration-150 cursor-default"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #f0f0f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      }}
                    >
                      {/* Colored left bar */}
                      <div className="w-1 flex-shrink-0" style={{ background: color }} />

                      <div className="flex-1 p-4 flex items-center gap-4">
                        {/* Time */}
                        <div className="flex-shrink-0 text-right" style={{ minWidth: "70px" }}>
                          {isAllDay ? (
                            <span className="text-xs italic text-gray-400">All day</span>
                          ) : (
                            <div>
                              <p className="text-sm font-bold text-gray-500 leading-none">{startTime}</p>
                              <p className="text-xs text-gray-300 mt-0.5">{endTime}</p>
                            </div>
                          )}
                        </div>

                        {/* Divider */}
                        <div className="w-px self-stretch flex-shrink-0" style={{ background: "#f0f0f0" }} />

                        {/* Title + date */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-bold text-gray-900 truncate"
                            style={{ fontSize: "16px" }}
                          >
                            {event.summary || "(No title)"}
                          </p>
                          {view === "week" && (
                            <p className="text-xs text-gray-400 mt-0.5">{eventDate}</p>
                          )}
                        </div>

                        {/* Color dot */}
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>

        {/* Right panel */}
        <div className="px-5 py-5 flex-shrink-0">
          <RightPanel events={events} loading={loading} />
        </div>
      </div>
    </div>
  );
}
