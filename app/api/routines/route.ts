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

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('routines')
    .select(`
      *,
      family_members (
        id,
        name,
        role,
        color
      )
    `)
    .eq('family_id', family_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routines: data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const body = await req.json()
  const {
    title,
    description,
    type,
    frequency,
    days_of_week,
    time_of_day,
    family_member_id,
    assignee_ids,
  } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const validTypes = ['habit', 'gear', 'checklist']
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
  }

  const validFrequencies = ['daily', 'weekly', 'before_event']
  if (frequency && !validFrequencies.includes(frequency)) {
    return NextResponse.json({ error: `frequency must be one of: ${validFrequencies.join(', ')}` }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('routines')
    .insert({
      family_id,
      family_member_id: family_member_id ?? null,
      assignee_ids: assignee_ids ?? [],
      title,
      description: description ?? null,
      type: type ?? 'habit',
      frequency: frequency ?? 'daily',
      days_of_week: days_of_week ?? [],
      time_of_day: time_of_day ?? null,
      active: true,
    })
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
  return NextResponse.json({ routine: data }, { status: 201 })
}
