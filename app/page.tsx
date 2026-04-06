"use client"
import Link from "next/link";
import { useSession } from "next-auth/react";

const features = [
  {
    icon: "📅",
    title: "Multi-Source Calendar",
    description: "Sync Google Calendar, iCloud, and more. See every family member schedule in one unified view.",
  },
  {
    icon: "🤝",
    title: "Coordination Agent",
    description: "Who is handling this? Fraydi AI assigns, reminds, and confirms who is handling each task so nothing slips.",
  },
  {
    icon: "👁️",
    title: "Smart Watchlists",
    description: "Track optional events, school activities, and local happenings your family might want to join.",
  },
  {
    icon: "🛒",
    title: "Shopping & To-Dos",
    description: "Shared lists that update in real time. Add items anytime, auto-categorize by store section.",
  },
];

export default function HomePage() {
  const { data: session } = useSession()

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-2xl font-bold text-orange-500">Fraydi</span>
        {session ? (
          <Link
            href="/dashboard"
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition"
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition"
          >
            Sign In
          </Link>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Flow routines across your day,{" "}
          <span className="text-orange-500">intelligently.</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          The AI agent that keeps your family in sync — calendars, coordination, and daily routines, all in one place.
        </p>
        <Link
          href="/login"
          className="inline-block bg-orange-500 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-orange-600 transition shadow-lg"
        >
          Get Started Free
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {features.map((f) => (
          <div key={f.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-orange-500 py-16 text-center text-white">
        <h2 className="text-3xl font-bold mb-4">Ready to sync your family?</h2>
        <p className="text-orange-100 mb-8">Join families already using Fraydi to stay coordinated.</p>
        <Link
          href="/login"
          className="inline-block bg-white text-orange-500 px-8 py-4 rounded-xl text-lg font-bold hover:bg-orange-50 transition"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-400 text-sm border-t border-gray-100">
        <p>Fraydi &copy; {new Date().getFullYear()} &mdash; Flow routines across your day, intelligently.</p>
      </footer>
    </main>
  );
}
