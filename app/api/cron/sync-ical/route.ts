export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// This endpoint is called by Vercel Cron every 4 hours
// It delegates to /api/calendar/import for each source — which has RRULE expansion
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerSupabase()
  const { data: sources, error } = await db.from('calendar_sources').select('*').eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sources?.length) return NextResponse.json({ synced: 0, total: 0 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app'
  let synced = 0, failed = 0

  for (const source of sources) {
    try {
      const res = await fetch(`${appUrl}/api/calendar/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ical_url: source.ical_url,
          profile_id: source.profile_id,
          family_id: source.family_id,
          calendar_name: source.name,
          color: source.color,
        }),
      })
      if (res.ok) { synced++ } else { failed++ }
    } catch { failed++ }
  }

  return NextResponse.json({ synced, failed, total: sources.length })
}
