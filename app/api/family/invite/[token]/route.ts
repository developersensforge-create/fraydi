import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/family/invite/[token] — (no auth) returns invite info for display on invite page
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const db = createServerSupabase()

    const { data: member, error } = await db
      .from('family_members')
      .select('id, name, role, email, invite_status, calendar_access, family_id, families(name)')
      .eq('invite_token', params.token)
      .single()

    if (error || !member) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 })
    }

    if (member.invite_status === 'accepted') {
      return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 410 })
    }

    if (member.invite_status === 'declined') {
      return NextResponse.json({ error: 'This invite has been declined' }, { status: 410 })
    }

    // Get family name and inviter info
    const familyData = member.families as { name?: string } | null

    return NextResponse.json({
      invite: {
        member_id: member.id,
        member_name: member.name,
        role: member.role,
        family_name: familyData?.name || 'a family',
        invite_status: member.invite_status,
      },
    })
  } catch (err) {
    console.error('[GET /api/family/invite/[token]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
