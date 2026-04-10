import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/watch/sources/[id]/events — all events for a specific watch source
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id

  const url = `${SUPABASE_URL}/rest/v1/watch_events?watch_source_id=eq.${encodeURIComponent(sourceId)}&select=id,title,event_date,event_time,location,description,price,tags,url,interest_level&order=event_date.asc`

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text, sourceId }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ events: data ?? [], count: data?.length ?? 0 })
}
