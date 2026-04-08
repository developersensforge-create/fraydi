import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// POST /api/family/join — accept invite by token
// Body: { token: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { token } = body

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const db = createServerSupabase()

    // Look up invitation by token
    const { data: invitation, error: inviteError } = await db
      .from('family_invitations')
      .select('*')
      .eq('token', token.trim())
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used or expired' }, { status: 410 })
    }

    // Check expiry
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await db
        .from('family_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }

    // Look up current user's profile
    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.family_id && profile.family_id !== invitation.family_id) {
      return NextResponse.json({ error: 'You are already in a different family' }, { status: 409 })
    }

    // Add user to family
    await db
      .from('profiles')
      .update({ family_id: invitation.family_id, role: 'member' })
      .eq('id', profile.id)

    // Mark invitation as accepted
    await db
      .from('family_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    // Fetch family info to return
    const { data: family } = await db
      .from('families')
      .select('*')
      .eq('id', invitation.family_id)
      .single()

    return NextResponse.json({ family, success: true })
  } catch (err) {
    console.error('[POST /api/family/join]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
