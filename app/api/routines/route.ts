import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getProfile(email: string) {
  const db = createServerSupabase()
  const { data } = await db.from('profiles').select('id, family_id').eq('email', email).single()
  return data
}

// GET /api/routines — fetch all active routines for the family
export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ routines: [] })

  const db = createServerSupabase()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const { data } = await db.from('family_routines')
    .select('*')
    .eq('family_id', profile.family_id)
    .eq('active', true)
    .order('created_at', { ascending: true })

  // Attach today's done status
  const routines = (data ?? []).map(r => ({
    id: r.id,
    title: r.title,
    assigned: r.assigned,
    color: r.color,
    time: r.time_label,
    emoji: r.emoji,
    repeat: r.repeat_type,
    days: r.days ?? undefined,
    done: Array.isArray(r.done_dates) && r.done_dates.includes(today),
  }))

  return NextResponse.json({ routines })
}

// POST /api/routines — create a new routine
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  const body = await req.json()
  const { title, assigned, color, time, emoji, repeat, days } = body

  const db = createServerSupabase()
  const { data, error } = await db.from('family_routines').insert({
    family_id: profile.family_id,
    created_by: profile.id,
    title,
    assigned: assigned ?? 'Everyone',
    color: color ?? '#f96400',
    time_label: time ?? '8:00am',
    emoji: emoji ?? null,
    repeat_type: repeat ?? 'daily',
    days: days ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routine: data })
}
