import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold text-[#f96400] tracking-tight">Fraydi</span>
        </Link>

        {/* Nav links — hidden on mobile */}
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

        {/* CTA */}
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
      </div>
    </header>
  )
}
