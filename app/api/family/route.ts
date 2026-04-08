import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/family — returns { family, members, kids, subscription }
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerSupabase()

    // Look up profile by email — auto-create if missing (handles existing Google sessions)
    let { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!profile) {
      const { data: newProfile } = await db
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: session.user.email,
          full_name: session.user.name ?? '',
          avatar_url: session.user.image ?? '',
          role: 'member',
          color: '#f96400',
        })
        .select()
        .single()
      profile = newProfile
    }

    if (!profile) {
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }

    if (!profile.family_id) {
      return NextResponse.json({ family: null, members: [], kids: [], subscription: null })
    }

    // Fetch family
    const { data: family } = await db
      .from('families')
      .select('*')
      .eq('id', profile.family_id)
      .single()

    // Fetch members
    const { data: members } = await db
      .from('profiles')
      .select('*')
      .eq('family_id', profile.family_id)

    // Fetch kids
    const { data: kids } = await db
      .from('kids')
      .select('*')
      .eq('family_id', profile.family_id)

    // Fetch subscription
    const { data: subscription } = await db
      .from('subscriptions')
      .select('*')
      .eq('family_id', profile.family_id)
      .single()

    return NextResponse.json({ family, members: members || [], kids: kids || [], subscription })
  } catch (err) {
    console.error('[GET /api/family]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/family — creates new family, sets user as admin, creates trialing subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Family name is required' }, { status: 400 })
    }

    const db = createServerSupabase()

    // Look up profile — auto-create if missing
    let { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!profile) {
      const { data: newProfile } = await db
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: session.user.email,
          full_name: session.user.name ?? '',
          avatar_url: session.user.image ?? '',
          role: 'member',
          color: '#f96400',
        })
        .select()
        .single()
      profile = newProfile
    }

    if (!profile) {
      return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
    }

    if (profile.family_id) {
      return NextResponse.json({ error: 'Already in a family' }, { status: 409 })
    }

    // Create family
    const { data: family, error: familyError } = await db
      .from('families')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (familyError || !family) {
      console.error('[POST /api/family] create family error:', familyError)
      return NextResponse.json({ error: 'Failed to create family' }, { status: 500 })
    }

    // Update profile: set family_id and role=admin
    await db
      .from('profiles')
      .update({ family_id: family.id, role: 'admin' })
      .eq('id', profile.id)

    // Create subscription (trialing)
    const { data: subscription } = await db
      .from('subscriptions')
      .insert({ family_id: family.id })
      .select()
      .single()

    return NextResponse.json({ family, subscription }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/family]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
