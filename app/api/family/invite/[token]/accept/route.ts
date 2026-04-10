import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// POST /api/family/invite/[token]/accept — accept invite, set calendar_access
// Body: { calendar_access: 'full' | 'busy_only' }
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const { calendar_access } = body

    const validAccess = ['full', 'busy_only']
    if (!calendar_access || !validAccess.includes(calendar_access)) {
      return NextResponse.json(
        { error: 'calendar_access must be one of: full, busy_only' },
        { status: 400 }
      )
    }

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

    // Accept the invite
    const { data: updated, error: updateError } = await db
      .from('family_members')
      .update({
        invite_status: 'accepted',
        calendar_access,
      })
      .eq('id', member.id)
      .select()
      .single()

    if (updateError || !updated) {
      console.error('[POST /api/family/invite/[token]/accept]', updateError)
      return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
    }

    return NextResponse.json({ success: true, calendar_access: updated.calendar_access })
  } catch (err) {
    console.error('[POST /api/family/invite/[token]/accept]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
