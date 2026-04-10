import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// DELETE /api/family/children/[id] — remove a child from the family
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

    // Verify the child belongs to this family
    const { data: existing } = await db
      .from('family_children')
      .select('id')
      .eq('id', params.id)
      .eq('family_id', profile.family_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 })
    }

    const { error } = await db
      .from('family_children')
      .delete()
      .eq('id', params.id)
      .eq('family_id', profile.family_id)

    if (error) {
      console.error('[DELETE /api/family/children/[id]]', error)
      return NextResponse.json({ error: 'Failed to delete child' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/family/children/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
