import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// PATCH /api/family/members/[id]/equipment/[equipId] — update equipment item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; equipId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, remind_external_only } = body

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (name?.trim()) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (remind_external_only !== undefined) updates.remind_external_only = remind_external_only

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: item, error } = await db
      .from('member_equipment')
      .update(updates)
      .eq('id', params.equipId)
      .eq('family_member_id', params.id)
      .eq('family_id', profile.family_id)
      .select()
      .single()

    if (error || !item) {
      console.error('[PATCH /api/family/members/[id]/equipment/[equipId]]', error)
      return NextResponse.json({ error: 'Failed to update equipment' }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[PATCH /api/family/members/[id]/equipment/[equipId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/family/members/[id]/equipment/[equipId] — remove equipment item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; equipId: string } }
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

    const { error } = await db
      .from('member_equipment')
      .delete()
      .eq('id', params.equipId)
      .eq('family_member_id', params.id)
      .eq('family_id', profile.family_id)

    if (error) {
      console.error('[DELETE /api/family/members/[id]/equipment/[equipId]]', error)
      return NextResponse.json({ error: 'Failed to delete equipment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/family/members/[id]/equipment/[equipId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
