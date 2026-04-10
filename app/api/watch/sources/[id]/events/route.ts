import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

// GET /api/watch/sources/[id]/events — all events for a specific calendar source
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id

  // Try calendar_events table first (iCal imports)
  const { data: calEvents, error: calError } = await getSupabaseAdmin()
    .from('calendar_events')
    .select('id, title, start_time, end_time, location, description')
    .eq('calendar_source_id', sourceId)
    .order('start_time', { ascending: true })

  if (!calError && calEvents && calEvents.length > 0) {
    return NextResponse.json({ events: calEvents, source: 'calendar_events' })
  }

  // Fallback: watch_events table
  const { data: watchEvents, error: watchError } = await getSupabaseAdmin()
    .from('watch_events')
    .select('id, title, start_time, end_time, location, description')
    .eq('watch_source_id', sourceId)
    .order('start_time', { ascending: true })

  if (watchError) return NextResponse.json({ error: watchError.message }, { status: 500 })
  return NextResponse.json({ events: watchEvents ?? [], source: 'watch_events' })
}
