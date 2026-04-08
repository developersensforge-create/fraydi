"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function JoinPage() {
  const router = useRouter()
  const [token, setToken] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (token.trim()) {
      router.push(`/join/${token.trim()}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <span className="text-2xl font-extrabold text-[#f96400]">Fraydi</span>
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Join a family</h1>
        <p className="text-gray-500 text-sm mb-6">Enter your invite code or paste the full invite link.</p>

        <form onSubmit={handleSubmit} className="text-left">
          <input
            type="text"
            placeholder="Invite code or link..."
            value={token}
            onChange={e => setToken(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] focus:border-transparent mb-3"
          />
          <button
            type="submit"
            className="w-full bg-[#f96400] text-white py-3 rounded-xl font-bold hover:bg-[#d95400] transition"
          >
            Continue →
          </button>
        </form>

        <div className="mt-6">
          <Link href="/onboarding" className="text-sm text-gray-400 hover:text-gray-600">
            ← Create a new family instead
          </Link>
        </div>
      </div>
    </div>
  )
}
