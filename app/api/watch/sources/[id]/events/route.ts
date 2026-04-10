import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

// GET /api/watch/sources/[id]/events — all events for a specific watch source
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id

  const { data, error } = await getSupabaseAdmin()
    .from('watch_events')
    .select('id, title, event_date, event_time, location, description, price, tags, url, interest_level, dismissed')
    .eq('watch_source_id', sourceId)
    .eq('dismissed', false)
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}
