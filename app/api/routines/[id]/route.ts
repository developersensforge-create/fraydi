import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const body = await req.json()

  const allowed = [
    'assigned_to', 'title', 'description', 'recurrence',
    'days_of_week', 'time_of_day', 'reminder_minutes_before', 'active',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (updates.recurrence && !['daily', 'weekly', 'monthly'].includes(updates.recurrence as string)) {
    return NextResponse.json({ error: 'recurrence must be daily, weekly, or monthly' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('routines')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routine: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const { error } = await supabaseAdmin.from('routines').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
