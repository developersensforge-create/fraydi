import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// PATCH /api/family/members/[id] — update name/color/role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color, role, calendar_access, email } = body

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
    if (color) updates.color = color
    if (role) updates.role = role
    if (calendar_access) updates.calendar_access = calendar_access
    if (email !== undefined) updates.email = email || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: member, error } = await db
      .from('family_members')
      .update(updates)
      .eq('id', params.id)
      .eq('family_id', profile.family_id)
      .select()
      .single()

    if (error || !member) {
      console.error('[PATCH /api/family/members/[id]]', error)
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
    }

    return NextResponse.json({ member })
  } catch (err) {
    console.error('[PATCH /api/family/members/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/family/members/[id] — remove a family member
export async function DELETE(
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

    // Prevent deleting account holder
    const { data: existing } = await db
      .from('family_members')
      .select('role, is_account_holder')
      .eq('id', params.id)
      .eq('family_id', profile.family_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (existing.role === 'me' || existing.is_account_holder) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const { error } = await db
      .from('family_members')
      .delete()
      .eq('id', params.id)
      .eq('family_id', profile.family_id)

    if (error) {
      console.error('[DELETE /api/family/members/[id]]', error)
      return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/family/members/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
