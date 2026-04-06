"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

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
    } catch (e) {
      setError("Could not load calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to view your calendar</p>
          <button onClick={() => signIn("google")} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fraydi</h1>
            <p className="text-xs text-gray-400">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <img src={session.user.image} className="w-8 h-8 rounded-full" alt="avatar" />
            )}
            <span className="text-sm text-gray-600">{session?.user?.name?.split(" ")[0]}</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* View toggle */}
        <div className="flex gap-2 mb-6">
          {(["today", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                if (session?.accessToken) fetchCalendarEvents(session.accessToken as string);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                view === v ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {v === "today" ? "Today" : "This Week"}
            </button>
          ))}
          <button
            onClick={() => session?.accessToken && fetchCalendarEvents(session.accessToken as string)}
            className="ml-auto px-3 py-2 text-sm text-orange-500 border border-orange-200 rounded-lg"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Calendar Events */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading your calendar...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">{error}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-gray-500 font-medium">No events {view === "today" ? "today" : "this week"}</p>
            <p className="text-gray-400 text-sm mt-1">Enjoy the free time!</p>
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
                <div key={event.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 shadow-sm">
                  <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{event.summary || "(No title)"}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {view === "week" && <span className="mr-2">{eventDate}</span>}
                      {isAllDay ? "All day" : `${startTime} – ${endTime}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
