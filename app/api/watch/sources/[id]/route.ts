import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// PATCH /api/watch/sources/[id] — update source metadata
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
  const { name, color, active, interest_keywords } = body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (color !== undefined) updates.color = color
  if (active !== undefined) updates.active = active
  if (interest_keywords !== undefined) updates.interest_keywords = interest_keywords

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = createServerSupabase()
  const { data, error } = await db
    .from('watch_sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data })
}

// DELETE /api/watch/sources/[id] — delete source and its events (cascade handles events)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params
  const db = createServerSupabase()

  // Explicit delete of events in case cascade isn't set up
  await db.from('watch_events').delete().eq('watch_source_id', id)

  const { error } = await db.from('watch_sources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
