'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/Button'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/calendars', label: 'Calendars', icon: '📅' },
  { href: '/routines', label: 'Routines', icon: '🔔' },
  { href: '/watch', label: 'Radar', icon: '👀' },
  { href: '/family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
]

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold text-[#f96400] tracking-tight">Fraydi</span>
        </Link>

        {session ? (
          /* Signed-in nav */
          <>
            <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/calendars"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Calendars
              </Link>
              <Link
                href="/routines"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Routines
              </Link>
              <Link
                href="/watch"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Radar
              </Link>
              <Link
                href="/family"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Family
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              {session.user?.name && (
                <span className="hidden sm:block text-sm font-medium text-gray-600">
                  {session.user.name}
                </span>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          /* Signed-out nav */
          <>
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
              <Link href="#features" className="hover:text-gray-900 transition-colors">
                Features
              </Link>
              <Link href="#" className="hover:text-gray-900 transition-colors">
                Pricing
              </Link>
              <Link href="#" className="hover:text-gray-900 transition-colors">
                Blog
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <Link href="/login">
                <Button size="sm" className="text-sm">Get Started</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </header>

    {/* Mobile bottom nav — only shown when signed in */}
    {session && (
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex items-center justify-around px-2 pb-safe">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors ${
                active ? 'text-[#f96400]' : 'text-gray-400'
              }`}>
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[10px] font-medium ${active ? 'text-[#f96400]' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    )}
    </>
  )
}
