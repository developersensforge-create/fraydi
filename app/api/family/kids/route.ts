import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/family/kids — returns kids for current user's family
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
      return NextResponse.json({ kids: [] })
    }

    const { data: kids, error } = await db
      .from('kids')
      .select('*, kids_activities(*)')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ kids: kids || [] })
  } catch (err) {
    console.error('[GET /api/family/kids]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/family/kids — create a kid record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color, age, grade } = body

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
      return NextResponse.json({ error: 'You must be in a family to add kids' }, { status: 400 })
    }

    const { data: kid, error } = await db
      .from('kids')
      .insert({
        family_id: profile.family_id,
        name: name.trim(),
        color: color || '#8b5cf6',
        age: age || null,
        grade: grade || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ kid }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/family/kids]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
