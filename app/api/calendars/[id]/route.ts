import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PATCH /api/calendars/[id] — update fields (owner_type, owner_name, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'Calendar source id is required' }, { status: 400 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.owner_type !== undefined) updates.owner_type = body.owner_type
    if (body.owner_name !== undefined) updates.owner_name = body.owner_name
    if (body.active !== undefined) updates.active = body.active
    if (body.name !== undefined) updates.name = body.name
    if (body.color !== undefined) updates.color = body.color

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('calendar_sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ calendar: data })
  } catch (err) {
    console.error('[PATCH /api/calendars/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/calendars/[id] — remove a calendar source

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Calendar source id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('calendar_sources')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted_id: id })
  } catch (err) {
    console.error('[DELETE /api/calendars/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
