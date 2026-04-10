import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/watch/sources/[id]/events — all events for a specific watch source
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id
  const db = createServerSupabase()

  const { data, error } = await db
    .from('watch_events')
    .select('id, title, event_date, event_time, location, description, price, tags, url, interest_level')
    .eq('watch_source_id', sourceId)
    .order('event_date', { ascending: true })

  if (error) {
    console.error('[watch/sources/[id]/events]', error.message, 'sourceId:', sourceId)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [], sourceId, count: data?.length ?? 0 })
}
