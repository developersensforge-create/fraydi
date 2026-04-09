import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getFamilyId(email: string): Promise<string | null> {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('email', email)
    .single()
  return data?.family_id ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const { id } = params
  const body = await req.json()

  const allowed = [
    'family_member_id',
    'title',
    'description',
    'type',
    'frequency',
    'days_of_week',
    'time_of_day',
    'active',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const validTypes = ['habit', 'gear', 'checklist']
  if (updates.type && !validTypes.includes(updates.type as string)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
  }

  const validFrequencies = ['daily', 'weekly', 'before_event']
  if (updates.frequency && !validFrequencies.includes(updates.frequency as string)) {
    return NextResponse.json({ error: `frequency must be one of: ${validFrequencies.join(', ')}` }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('routines')
    .update(updates)
    .eq('id', id)
    .eq('family_id', family_id) // ensure ownership
    .select(`
      *,
      family_members (
        id,
        name,
        role,
        color
      )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routine: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const { id } = params
  const supabase = createServerSupabase()

  // checklist_items cascade via FK, but let's be explicit
  const { error: checklistError } = await supabase
    .from('checklist_items')
    .delete()
    .eq('routine_id', id)

  if (checklistError) {
    return NextResponse.json({ error: checklistError.message }, { status: 500 })
  }

  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', id)
    .eq('family_id', family_id) // ensure ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
