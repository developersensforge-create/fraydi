import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/calendar/sync
// Body: { family_id: string }
// Re-fetches all iCal URLs stored for a family and updates events

interface SyncBody {
  family_id: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncBody = await request.json()
    const { family_id } = body

    if (!family_id) {
      return NextResponse.json({ error: 'family_id is required' }, { status: 400 })
    }

    // Fetch all calendar sources for this family
    const { data: sources, error: sourcesError } = await supabase
      .from('calendar_sources')
      .select('*')
      .eq('family_id', family_id)

    if (sourcesError) {
      return NextResponse.json({ error: sourcesError.message }, { status: 500 })
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No calendar sources found for this family' })
    }

    const results: Array<{ name: string; imported: number; error?: string }> = []

    for (const source of sources) {
      try {
        // Delegate to the import endpoint internally
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const importResponse = await fetch(`${baseUrl}/api/calendar/import`, {
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

        const result = await importResponse.json()

        if (importResponse.ok) {
          results.push({ name: source.name, imported: result.imported ?? 0 })
        } else {
          results.push({ name: source.name, imported: 0, error: result.error })
        }
      } catch (err) {
        results.push({
          name: source.name,
          imported: 0,
          error: (err as Error).message,
        })
      }
    }

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0)

    return NextResponse.json({
      synced: results.length,
      total_events: totalImported,
      results,
    })
  } catch (err) {
    console.error('[calendar/sync] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
