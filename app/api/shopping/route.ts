import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getProfile(email: string) {
  const db = createServerSupabase()
  const { data } = await db.from('profiles').select('id, family_id, full_name').eq('email', email).single()
  return data
}

// GET — fetch all items for this batch
export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ items: [] })

  const db = createServerSupabase()
  const { data } = await db.from('shopping_items')
    .select('id, name, category, quantity, is_checked, checked, added_by, checked_by_name, batch_id, created_at')
    .eq('family_id', profile.family_id)
    .order('created_at', { ascending: true })

  // Normalize is_checked / checked
  const items = (data ?? []).map(i => ({
    ...i,
    checked: i.is_checked || i.checked || false,
    addedByName: null, // will resolve from profile later if needed
  }))

  return NextResponse.json({ items, profileId: profile.id, profileName: profile.full_name })
}

// POST — add item
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  const { name, quantity, category } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const db = createServerSupabase()
  const { data, error } = await db.from('shopping_items').insert({
    family_id: profile.family_id,
    added_by: profile.id,
    name: name.trim(),
    quantity: quantity ?? null,
    category: category ?? null,
    is_checked: false,
    checked: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// PATCH — toggle checked
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(session.user.email)

  const { id, checked } = await req.json()
  const db = createServerSupabase()
  await db.from('shopping_items').update({
    is_checked: checked,
    checked,
    checked_by_name: checked ? (profile?.full_name ?? 'Someone') : null,
  }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// DELETE — clear all checked items (shopping trip done)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(session.user.email)
  if (!profile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') // 'checked' or 'all'

  const db = createServerSupabase()
  if (mode === 'all') {
    await db.from('shopping_items').delete().eq('family_id', profile.family_id)
  } else {
    await db.from('shopping_items').delete().eq('family_id', profile.family_id).eq('is_checked', true)
  }
  return NextResponse.json({ ok: true })
}
