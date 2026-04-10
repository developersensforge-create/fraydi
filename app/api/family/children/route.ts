import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/family/children — list children for the current family
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
      return NextResponse.json({ children: [] })
    }

    const { data: children, error } = await db
      .from('family_children')
      .select('*')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ children: children || [] })
  } catch (err) {
    console.error('[GET /api/family/children]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/family/children — add a child to the family
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, birth_date, grade } = body

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

    const { data: child, error } = await db
      .from('family_children')
      .insert({
        family_id: profile.family_id,
        name: name.trim(),
        birth_date: birth_date || null,
        grade: grade != null ? parseInt(String(grade)) : null,
      })
      .select()
      .single()

    if (error || !child) {
      console.error('[POST /api/family/children]', error)
      return NextResponse.json({ error: 'Failed to create child' }, { status: 500 })
    }

    return NextResponse.json({ child }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/family/children]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
