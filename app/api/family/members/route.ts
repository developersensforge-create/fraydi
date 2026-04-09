import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/family/members — list family members
export async function GET() {
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
      return NextResponse.json({ members: [] })
    }

    const { data: members } = await db
      .from('family_members')
      .select('*')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ members: members || [] })
  } catch (err) {
    console.error('[GET /api/family/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/family/members — add a family member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, role, color, age } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const validRoles = ['me', 'spouse', 'kid', 'other']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role must be one of: me, spouse, kid, other' }, { status: 400 })
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

    const { data: member, error } = await db
      .from('family_members')
      .insert({
        family_id: profile.family_id,
        name: name.trim(),
        role,
        color: color || '#6366f1',
        age: age != null ? parseInt(String(age)) : null,
      })
      .select()
      .single()

    if (error || !member) {
      console.error('[POST /api/family/members]', error)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/family/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
