import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/watch/sources/[id]/events — all events for a specific watch source
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id
  const db = createServerSupabase()

  // First: total count of all watch_events (debug)
  const { count: totalCount } = await db
    .from('watch_events')
    .select('*', { count: 'exact', head: true })

  const { data, error } = await db
    .from('watch_events')
    .select('id, title, event_date, event_time, location, description, price, tags, url, interest_level')
    .eq('watch_source_id', sourceId)
    .order('event_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message, sourceId }, { status: 500 })
  }

  return NextResponse.json({ 
    events: data ?? [], 
    count: data?.length ?? 0,
    totalInTable: totalCount,
    sourceId,
  })
}
