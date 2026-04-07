'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/Button'

export default function Navbar() {
  const { data: session } = useSession()

  return (
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
                href="/routines"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Routines
              </Link>
              <Link
                href="/watch"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Watch List
              </Link>
              <Link
                href="/calendars"
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Calendars
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
  )
}
