import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const family_id = searchParams.get('family_id')
  const dateStr = searchParams.get('date') // YYYY-MM-DD
  const tz = searchParams.get('tz') ?? 'UTC'

  if (!family_id) {
    return NextResponse.json({ error: 'family_id required' }, { status: 400 })
  }

  // Build date window: today through +30 days by default, or ±7 around given date
  const center = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date()
  if (isNaN(center.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const rangeStart = new Date(center)
  rangeStart.setDate(rangeStart.getDate() - (dateStr ? 7 : 0))
  const startStr = rangeStart.toISOString().split('T')[0]

  const rangeEnd = new Date(center)
  rangeEnd.setDate(rangeEnd.getDate() + 30)
  const endStr = rangeEnd.toISOString().split('T')[0]

  const { data, error } = await getSupabaseAdmin()
    .from('watch_events')
    .select('*, watch_sources(name, color)')
    .eq('family_id', family_id)
    .gte('event_date', startStr)
    .lte('event_date', endStr)
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data, tz })
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 })
  }

  const body = await req.json()
  const { interest_level, dismissed } = body

  const updates: Record<string, unknown> = {}
  if (interest_level !== undefined) {
    if (!['watch', 'interested', 'hot'].includes(interest_level)) {
      return NextResponse.json({ error: 'interest_level must be watch, interested, or hot' }, { status: 400 })
    }
    updates.interest_level = interest_level
  }
  if (dismissed !== undefined) updates.dismissed = dismissed

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('watch_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}
