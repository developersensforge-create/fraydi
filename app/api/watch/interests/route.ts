import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getFamilyId(email: string): Promise<string | null> {
  const db = createServerSupabase()
  const { data: profile } = await db
    .from('profiles')
    .select('family_id')
    .eq('email', email)
    .single()
  return profile?.family_id ?? null
}

// GET /api/watch/interests — get family_interests for current user's family
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const familyId = await getFamilyId(session.user.email)
  if (!familyId) {
    return NextResponse.json({ interests: null })
  }

  const db = createServerSupabase()
  const { data, error } = await db
    .from('family_interests')
    .select('*')
    .eq('family_id', familyId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "no rows returned" — not an error here
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ interests: data ?? { family_id: familyId, keywords: [] } })
}

// PATCH /api/watch/interests — upsert family interests
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { keywords } = body

  if (!Array.isArray(keywords)) {
    return NextResponse.json({ error: 'keywords must be an array of strings' }, { status: 400 })
  }

  const familyId = await getFamilyId(session.user.email)
  if (!familyId) {
    return NextResponse.json(
      { error: 'No family found. Please create or join a family first.' },
      { status: 400 }
    )
  }

  const db = createServerSupabase()

  // Check if record exists
  const { data: existing } = await db
    .from('family_interests')
    .select('id')
    .eq('family_id', familyId)
    .single()

  let result
  if (existing) {
    const { data, error } = await db
      .from('family_interests')
      .update({ keywords, updated_at: new Date().toISOString() })
      .eq('family_id', familyId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await db
      .from('family_interests')
      .insert({ family_id: familyId, keywords })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json({ interests: result })
}
