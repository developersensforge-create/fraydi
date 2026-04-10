import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/family/members/[id]/resend-invite
export async function POST(
  _req: NextRequest,
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
      .select('full_name, family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    const { data: member } = await db
      .from('family_members')
      .select('*')
      .eq('id', params.id)
      .eq('family_id', profile.family_id)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!member.email) return NextResponse.json({ error: 'No email on file for this member' }, { status: 400 })

    const inviterName = (profile as any).full_name ?? session.user.email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join?token=${member.invite_token}`

    const { error: resendError } = await resend.emails.send({
      from: 'Fraydi <noreply@dayryz.com>',
      to: member.email,
      subject: `${inviterName} invited you to coordinate on Fraydi`,
      html: `
        <p>Hi ${member.name},</p>
        <p><strong>${inviterName}</strong> has invited you to join their family on <strong>Fraydi</strong> — a family coordination app.</p>
        <p><a href="${inviteUrl}" style="background:#f96400;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin:12px 0;">Accept Invite</a></p>
        <p style="color:#999;font-size:12px;">If you weren't expecting this, you can ignore this email.</p>
      `,
    })

    if (resendError) return NextResponse.json({ error: resendError.message }, { status: 500 })

    await db.from('family_members').update({ invite_status: 'pending' }).eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/family/members/[id]/resend-invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
