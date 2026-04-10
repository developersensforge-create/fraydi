import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

async function getFamilyId(email: string): Promise<string | null> {
  const db = createServerSupabase()
  const { data } = await db.from('profiles').select('family_id').eq('email', email).single()
  return data?.family_id ?? null
}

export async function GET(req: NextRequest) {
  let family_id = req.nextUrl.searchParams.get('family_id')
  if (!family_id) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    family_id = await getFamilyId(session.user.email)
    if (!family_id) return NextResponse.json({ routines: [] })
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    title,
    description,
    type,
    frequency,
    recurrence,
    days_of_week,
    time_of_day,
    assignee_ids,
    assigned_to,
  } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Accept both 'frequency' (frontend) and 'recurrence' (legacy)
  const rec = recurrence ?? frequency ?? 'daily'
  if (!['daily', 'weekly', 'monthly'].includes(rec)) {
    return NextResponse.json({ error: 'frequency must be daily, weekly, or monthly' }, { status: 400 })
  }

  // Get family_id from session
  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('routines')
    .insert({
      family_id,
      title,
      description: description ?? null,
      type: type ?? 'habit',
      frequency: rec,
      days_of_week: days_of_week ?? [],
      time_of_day: time_of_day ?? null,
      assignee_ids: assignee_ids ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routine: data }, { status: 201 })
}
