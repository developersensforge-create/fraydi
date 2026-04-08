"use client"
import Link from "next/link"
import { useSession } from "next-auth/react"

const features = [
  {
    icon: "🗓️",
    title: "One unified calendar",
    description: "Google, Outlook, iCal — all your family's events in one place.",
  },
  {
    icon: "⚡",
    title: "AI conflict detection",
    description: "Fraydi spots when you're both booked and no one's watching the kids. Before it's a problem.",
  },
  {
    icon: "🤝",
    title: "Partner nudges",
    description: "Passive partner? Fraydi checks in so you don't have to.",
  },
  {
    icon: "✅",
    title: "Shared tasks & routines",
    description: "Groceries, chores, pickups — assigned, tracked, done.",
  },
]

export default function HomePage() {
  const { data: session } = useSession()

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-2xl font-extrabold text-[#f96400] tracking-tight">Fraydi</span>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href="/dashboard"
                className="bg-[#f96400] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#d95400] transition"
              >
                Go to dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="bg-[#f96400] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#d95400] transition"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-[#f96400] text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-orange-100">
          🎉 Join early families — 30-day Pro trial included
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Stop being your family&apos;s{" "}
          <span className="text-[#f96400]">unpaid project manager</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          Fraydi is the AI coordination layer for busy families. One view, zero conflicts, both partners aligned.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {session ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-[#f96400] text-white px-8 py-4 rounded-xl text-base font-bold hover:bg-[#d95400] transition shadow-lg shadow-orange-200"
            >
              Go to dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-[#f96400] text-white px-8 py-4 rounded-xl text-base font-bold hover:bg-[#d95400] transition shadow-lg shadow-orange-200"
              >
                Start free — 30 days on us
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-8 py-4 rounded-xl text-base font-semibold hover:bg-gray-50 transition"
              >
                See how it works ↓
              </a>
            </>
          )}
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-gray-400">
          Join early families already using Fraydi to stay coordinated
        </p>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-gray-50 border-t border-b border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
              Everything your family needs, nothing you don&apos;t
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Built for dual-income households where coordination is a full-time job.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-[#f96400] hover:shadow-sm transition-all">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">Simple, family-friendly pricing</h2>
            <p className="text-gray-500 text-lg">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Free</h3>
                <p className="text-gray-500 text-sm mb-4">Get started, no credit card needed</p>
                <div className="text-4xl font-extrabold text-gray-900">$0</div>
                <p className="text-gray-400 text-sm mt-1">forever</p>
              </div>
              <ul className="space-y-3 text-sm text-gray-600 mb-8 flex-1">
                <li className="flex items-center gap-2">✅ 1 user</li>
                <li className="flex items-center gap-2">✅ Basic calendar view</li>
                <li className="flex items-center gap-2">✅ 30-day Pro trial included</li>
                <li className="flex items-center gap-2 text-gray-400">✗ AI conflict detection</li>
                <li className="flex items-center gap-2 text-gray-400">✗ Partner nudges</li>
                <li className="flex items-center gap-2 text-gray-400">✗ Task management</li>
              </ul>
              <Link
                href="/login"
                className="block text-center border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
              >
                Get started free
              </Link>
            </div>

            {/* Pro plan */}
            <div className="bg-[#f96400] rounded-2xl p-8 flex flex-col text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-white text-[#f96400] text-xs font-bold px-2 py-1 rounded-full">
                MOST POPULAR
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">Pro Family</h3>
                <p className="text-orange-100 text-sm mb-4">For both partners, all features</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold">$6.99</span>
                  <span className="text-orange-200 mb-1">/month</span>
                </div>
                <p className="text-orange-200 text-sm mt-1">or $59.99/year <span className="bg-white text-[#f96400] text-xs font-bold px-1.5 py-0.5 rounded ml-1">Save 28%</span></p>
              </div>
              <ul className="space-y-3 text-sm text-orange-50 mb-8 flex-1">
                <li className="flex items-center gap-2">✅ Both partners</li>
                <li className="flex items-center gap-2">✅ All features from Free</li>
                <li className="flex items-center gap-2">✅ AI conflict detection</li>
                <li className="flex items-center gap-2">✅ Partner nudges</li>
                <li className="flex items-center gap-2">✅ Task management</li>
                <li className="flex items-center gap-2">✅ 30-day free trial</li>
              </ul>
              <Link
                href="/login"
                className="block text-center bg-white text-[#f96400] px-6 py-3 rounded-xl font-bold hover:bg-orange-50 transition"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="bg-gray-900 py-16 text-center">
        <h2 className="text-3xl font-extrabold text-white mb-4">Ready to get your family in sync?</h2>
        <p className="text-gray-400 mb-8 text-lg">30 days free. No credit card required.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-[#f96400] text-white px-8 py-4 rounded-xl text-base font-bold hover:bg-[#d95400] transition shadow-lg"
        >
          Start free — 30 days on us
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 text-center text-gray-400 text-sm border-t border-gray-100">
        <p>© {new Date().getFullYear()} Fraydi — Built by SensForge</p>
      </footer>
    </main>
  )
}
