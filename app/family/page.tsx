'use client'

import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function FamilyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
        <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Family</h1>
        <p className="text-gray-500 mb-6">Manage your family members, children, and calendar sharing.</p>
        <p className="text-sm text-orange-500 font-medium bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 inline-block">
          🔨 Coming soon — family members & invite flow is built. UI in progress.
        </p>
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Back to Dashboard</Link>
        </div>
      </main>
    </div>
  )
}
