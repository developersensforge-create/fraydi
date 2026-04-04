import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fraydi — Flow routines across your day, intelligently.',
  description:
    'The AI agent that keeps your family in sync — calendars, coordination, and daily routines, all in one place.',
  keywords: ['family coordination', 'AI agent', 'calendar', 'routines', 'family planning'],
  openGraph: {
    title: 'Fraydi',
    description: 'Flow routines across your day, intelligently.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
