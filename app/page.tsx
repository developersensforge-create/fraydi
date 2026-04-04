import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const features = [
  {
    icon: '📅',
    title: 'Multi-Source Calendar',
    description:
      'Sync Google Calendar, iCloud, and more. See every family member's schedule in one unified view — no more missed pickups.',
  },
  {
    icon: '🤝',
    title: 'Coordination Agent',
    description:
      '"Who\'s got this?" — Fraydi\'s AI assigns, reminds, and confirms who\'s handling each task so nothing slips through the cracks.',
  },
  {
    icon: '👁️',
    title: 'Smart Watchlists',
    description:
      'Track price drops, restock alerts, and availability for things your family needs — school supplies, gear, groceries.',
  },
  {
    icon: '🛒',
    title: 'Shopping & To-Dos',
    description:
      'Shared lists that update in real time. Add items by voice or text, auto-categorise by store, and tick off together.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Background accent */}
        <div
          className="absolute inset-x-0 top-0 -z-10 h-96 opacity-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -20%, #f96400, transparent)',
          }}
        />

        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-1.5 text-sm font-medium text-[#f96400] ring-1 ring-orange-200 mb-6">
            ✨ AI-powered family coordination
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
            Flow routines across your day,{' '}
            <span className="text-[#f96400]">intelligently.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            The AI agent that keeps your family in sync — calendars, coordination, and daily
            routines, all in one place.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="px-8 py-4 text-base font-semibold shadow-lg shadow-orange-200">
                Get Started Free
              </Button>
            </Link>
            <Link
              href="#features"
              className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              See how it works →
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-400">Free to get started · No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything your family needs, in one agent
            </h2>
            <p className="mt-3 text-gray-500 text-lg max-w-xl mx-auto">
              Fraydi handles the coordination so you can focus on the moments that matter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to bring the flow back?
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            Join families already running their days with Fraydi.
          </p>
          <Link href="/login">
            <Button size="lg" className="px-10 py-4 text-base font-semibold shadow-lg shadow-orange-200">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold text-[#f96400]">Fraydi</span>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Fraydi. Flow routines across your day, intelligently.
          </p>
          <div className="flex gap-5 text-sm text-gray-400">
            <Link href="#" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link href="#" className="hover:text-gray-600 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
