'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/Button'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Hide upgrade link if user is on Pro (check subscription via session or just always show for now)
  // In production this would check session.user.plan — for now show to everyone
  const isPro = (session as { user?: { plan?: string } } | null)?.user?.plan === 'pro'

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/family', label: 'Family' },
    { href: '/dashboard', label: 'Tasks', scroll: false }, // Tasks are on dashboard sidebar
    { href: '/watch', label: 'Radar 📡' },
    { href: '/routines', label: 'Routines 🔔' },
    ...(!isPro ? [{ href: '/upgrade', label: 'Upgrade' }] : []),
  ]

  const isActive = (href: string) => pathname === href

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl font-extrabold text-[#f96400] tracking-tight">Fraydi</span>
        </Link>

        {session ? (
          <>
            {/* Signed-in desktop nav */}
            <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
              {navLinks.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    isActive(link.href)
                      ? 'bg-orange-50 text-[#f96400] font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  } ${link.label === 'Upgrade' && !isPro ? 'text-[#f96400] font-semibold' : ''}`}
                >
                  {link.label === 'Upgrade' && !isPro ? '⚡ Upgrade' : link.label}
                </Link>
              ))}
            </nav>

            {/* User info + sign out (desktop) */}
            <div className="hidden sm:flex items-center gap-3">
              {session.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#f96400] flex items-center justify-center text-white text-xs font-bold">
                  {session.user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              {session.user?.name && (
                <span className="text-sm font-medium text-gray-600 max-w-[120px] truncate">
                  {session.user.name.split(' ')[0]}
                </span>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <div className="w-5 h-0.5 bg-gray-600 mb-1 transition-all" />
              <div className="w-5 h-0.5 bg-gray-600 mb-1 transition-all" />
              <div className="w-5 h-0.5 bg-gray-600 transition-all" />
            </button>
          </>
        ) : (
          /* Signed-out nav */
          <>
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
              <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
              <Link href="/login">
                <Button size="sm" className="text-sm">Get Started</Button>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu dropdown */}
      {session && mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {/* User info */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-1">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#f96400] flex items-center justify-center text-white text-sm font-bold">
                {session.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{session.user?.name}</p>
              <p className="text-xs text-gray-400">{session.user?.email}</p>
            </div>
          </div>

          {navLinks.map(link => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-orange-50 text-[#f96400]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {link.label === 'Upgrade' && !isPro ? '⚡ Upgrade to Pro' : link.label}
            </Link>
          ))}

          <button
            onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/' }) }}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 text-left transition-colors mt-1 border-t border-gray-100 pt-3"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
