import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/family/members/[id]/resend-invite
// Creates a family_invitations row and emails the join link
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

    // Get inviter profile
    const { data: inviterProfile } = await db
      .from('profiles')
      .select('id, full_name, family_id')
      .eq('email', session.user.email)
      .single()

    if (!inviterProfile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    // Get the member being invited
    const { data: member } = await db
      .from('family_members')
      .select('*')
      .eq('id', params.id)
      .eq('family_id', inviterProfile.family_id)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!member.email) return NextResponse.json({ error: 'No email on file for this member' }, { status: 400 })

    // Create or update a family_invitations row
    const token = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: inviteErr } = await db
      .from('family_invitations')
      .insert({
        family_id: inviterProfile.family_id,
        invited_email: member.email,
        invited_by: inviterProfile.id,
        token,
        status: 'pending',
        expires_at: expiresAt,
      })

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 })
    }

    // Update member invite status
    await db.from('family_members')
      .update({ invite_status: 'pending', invite_token: token })
      .eq('id', params.id)

    const inviterName = (inviterProfile as any).full_name ?? session.user.email
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app').replace(/\/$/, '')
    const joinUrl = `${appUrl}/join/${token}`

    const { error: resendError } = await resend.emails.send({
      from: 'Fraydi <noreply@dayryz.com>',
      to: member.email,
      subject: `${inviterName} invited you to coordinate on Fraydi`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#f96400">You're invited to Fraydi 👨‍👩‍👧‍👦</h2>
          <p>Hi ${member.name},</p>
          <p><strong>${inviterName}</strong> has invited you to join their family on <strong>Fraydi</strong> — a family calendar coordination app.</p>
          <p>Once you join, you can share your Google Calendar and see everyone's schedule in one place.</p>
          <a href="${joinUrl}" style="display:inline-block;background:#f96400;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Accept Invite →
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            This link expires in 7 days. If you weren't expecting this, you can ignore it.
          </p>
        </div>
      `,
    })

    if (resendError) return NextResponse.json({ error: resendError.message }, { status: 500 })

    return NextResponse.json({ success: true, sent_to: member.email })
  } catch (err) {
    console.error('[POST resend-invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
