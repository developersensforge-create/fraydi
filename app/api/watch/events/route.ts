import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/watch/events — get all watch events for current user's family
// Query params: ?interest_level=hot&limit=20
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerSupabase()
  const { data: profile } = await db
    .from('profiles')
    .select('family_id')
    .eq('email', session.user.email)
    .single()

  if (!profile?.family_id) {
    return NextResponse.json({ events: [] })
  }

  const { searchParams } = req.nextUrl
  const interest_level = searchParams.get('interest_level')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  let query = db
    .from('watch_events')
    .select('*, watch_sources(id, name, color, type)')
    .eq('family_id', profile.family_id)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (interest_level) {
    query = query.eq('interest_level', interest_level)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data })
}
