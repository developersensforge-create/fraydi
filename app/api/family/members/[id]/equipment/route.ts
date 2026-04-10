import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/family/members/[id]/equipment — list all equipment for this member
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    const { data: items, error } = await db
      .from('member_equipment')
      .select('*')
      .eq('family_member_id', params.id)
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GET /api/family/members/[id]/equipment]', error)
      return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 })
    }

    return NextResponse.json({ items: items ?? [] })
  } catch (err) {
    console.error('[GET /api/family/members/[id]/equipment]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/family/members/[id]/equipment — add new equipment item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, remind_external_only, event_keywords } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    // Verify member belongs to this family
    const { data: member } = await db
      .from('family_members')
      .select('id')
      .eq('id', params.id)
      .eq('family_id', profile.family_id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { data: item, error } = await db
      .from('member_equipment')
      .insert({
        family_member_id: params.id,
        family_id: profile.family_id,
        name: name.trim(),
        description: description?.trim() || null,
        remind_external_only: remind_external_only ?? false,
        event_keywords: Array.isArray(event_keywords) ? event_keywords : [],
      })
      .select()
      .single()

    if (error || !item) {
      console.error('[POST /api/family/members/[id]/equipment]', error)
      return NextResponse.json({ error: 'Failed to add equipment' }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[POST /api/family/members/[id]/equipment]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
