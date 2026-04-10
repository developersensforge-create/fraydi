import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// POST /api/family/invite/[token]/decline — decline an invite
export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = createServerSupabase()

    // Verify token exists and is still pending
    const { data: member, error: fetchError } = await db
      .from('family_members')
      .select('id, invite_status')
      .eq('invite_token', params.token)
      .single()

    if (fetchError || !member) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 })
    }

    if (member.invite_status !== 'pending') {
      return NextResponse.json(
        { error: `Invite is already ${member.invite_status}` },
        { status: 409 }
      )
    }

    // Decline the invite
    const { error: updateError } = await db
      .from('family_members')
      .update({ invite_status: 'declined' })
      .eq('id', member.id)

    if (updateError) {
      console.error('[POST /api/family/invite/[token]/decline]', updateError)
      return NextResponse.json({ error: 'Failed to decline invite' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/family/invite/[token]/decline]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
