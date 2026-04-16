import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getProfile(email: string) {
  const db = createServerSupabase()
  const { data } = await db.from('profiles').select('id, family_id, full_name').eq('email', email).single()
  return data
}

// GET — fetch all active notes for family
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  // Allow unauthenticated access with family_id param (for kids page)
  const family_id = req.nextUrl.searchParams.get('family_id')

  let fid = family_id
  if (!fid && session?.user?.email) {
    const profile = await getProfile(session.user.email)
    fid = profile?.family_id ?? null
  }
  if (!fid) return NextResponse.json({ notes: [] })

  const db = createServerSupabase()
  const { data } = await db.from('family_notes')
    .select('*')
    .eq('family_id', fid)
    .eq('is_done', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ notes: data ?? [] })
}

// POST — add note
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { content, author_name, note_type, family_id } = body

  if (!content?.trim() || !family_id) {
    return NextResponse.json({ error: 'content and family_id required' }, { status: 400 })
  }

  const db = createServerSupabase()
  const { data, error } = await db.from('family_notes').insert({
    family_id,
    author_name: author_name ?? 'Someone',
    content: content.trim(),
    note_type: note_type ?? 'general',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}

// PATCH — mark done (clear item)
export async function PATCH(req: NextRequest) {
  const { id, is_done } = await req.json()
  const db = createServerSupabase()
  await db.from('family_notes').update({ is_done }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// DELETE — clear all done/shopping notes (shopping trip done)
export async function DELETE(req: NextRequest) {
  const { family_id, note_type } = await req.json()
  if (!family_id) return NextResponse.json({ error: 'family_id required' }, { status: 400 })
  const db = createServerSupabase()
  let q = db.from('family_notes').delete().eq('family_id', family_id)
  if (note_type) q = q.eq('note_type', note_type)
  await q
  return NextResponse.json({ ok: true })
}
