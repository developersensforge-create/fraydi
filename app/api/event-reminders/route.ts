import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getProfile(email: string) {
  const db = createServerSupabase()
  const { data } = await db.from('profiles').select('id, family_id').eq('email', email).single()
  return data
}

// GET ?event_ids=id1,id2,id3
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ reminders: [] })
  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ reminders: [] })

  const eventIds = req.nextUrl.searchParams.get('event_ids')?.split(',').filter(Boolean) ?? []
  if (!eventIds.length) return NextResponse.json({ reminders: [] })

  const db = createServerSupabase()
  const { data } = await db.from('event_reminders')
    .select('*')
    .eq('family_id', profile.family_id)
    .in('event_id', eventIds)

  return NextResponse.json({ reminders: data ?? [] })
}

// POST — add reminder to event
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  const { event_id, label } = await req.json()
  if (!event_id || !label?.trim()) return NextResponse.json({ error: 'event_id and label required' }, { status: 400 })

  const db = createServerSupabase()
  const { data, error } = await db.from('event_reminders').insert({
    family_id: profile.family_id,
    event_id,
    label: label.trim(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reminder: data })
}

// PATCH — toggle done
export async function PATCH(req: NextRequest) {
  const { id, done } = await req.json()
  const db = createServerSupabase()
  await db.from('event_reminders').update({ done }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// DELETE — remove reminder
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const db = createServerSupabase()
  await db.from('event_reminders').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
