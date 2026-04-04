import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Family Profile — Fraydi',
  description: 'Manage your family group, members, and invite new people.',
}

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
