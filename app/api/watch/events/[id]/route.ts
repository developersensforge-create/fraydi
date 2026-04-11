import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// PATCH /api/watch/events/[id] — update interest level or added_to_calendar
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params
  const body = await req.json()
  const { interest_level, added_to_calendar } = body

  const updates: Record<string, unknown> = {}

  if (interest_level !== undefined) {
    if (!['watch', 'interested', 'hot'].includes(interest_level)) {
      return NextResponse.json(
        { error: 'interest_level must be one of: watch, interested, hot' },
        { status: 400 }
      )
    }
    updates.interest_level = interest_level
  }

  if (added_to_calendar !== undefined) {
    updates.added_to_calendar = added_to_calendar
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const db = createServerSupabase()
  const { data, error } = await db
    .from('watch_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}
