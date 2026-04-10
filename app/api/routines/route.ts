import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

export async function GET(req: NextRequest) {
  const family_id = req.nextUrl.searchParams.get('family_id')
  if (!family_id) {
    return NextResponse.json({ error: 'family_id required' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('routines')
    .select('*')
    .eq('family_id', family_id)
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routines: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    family_id,
    assigned_to,
    title,
    description,
    recurrence,
    days_of_week,
    time_of_day,
    reminder_minutes_before,
  } = body

  if (!family_id || !title || !recurrence) {
    return NextResponse.json({ error: 'family_id, title, and recurrence are required' }, { status: 400 })
  }

  if (!['daily', 'weekly', 'monthly'].includes(recurrence)) {
    return NextResponse.json({ error: 'recurrence must be daily, weekly, or monthly' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('routines')
    .insert({
      family_id,
      assigned_to: assigned_to ?? null,
      title,
      description: description ?? null,
      recurrence,
      days_of_week: days_of_week ?? [],
      time_of_day: time_of_day ?? null,
      reminder_minutes_before: reminder_minutes_before ?? 30,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routine: data }, { status: 201 })
}
