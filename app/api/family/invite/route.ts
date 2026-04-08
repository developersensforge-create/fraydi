import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/family/invite — send invite email
// Body: { email: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email: invitedEmail } = body

    if (!invitedEmail || !invitedEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const db = createServerSupabase()

    // Look up inviter's profile
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.family_id) {
      return NextResponse.json({ error: 'You must be in a family to invite members' }, { status: 400 })
    }

    // Create invitation record
    const { data: invitation, error: inviteError } = await db
      .from('family_invitations')
      .insert({
        family_id: profile.family_id,
        invited_email: invitedEmail,
        invited_by: profile.id,
      })
      .select()
      .single()

    if (inviteError || !invitation) {
      console.error('[POST /api/family/invite] create invite error:', inviteError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // Get family name
    const { data: family } = await db
      .from('families')
      .select('name')
      .eq('id', profile.family_id)
      .single()

    const inviterName = profile.full_name || session.user.name || session.user.email
    const familyName = family?.name || 'their family'
    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fraydi.vercel.app'}/join/${invitation.token}`

    // Send invite email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'Fraydi <noreply@dayryz.com>',
      to: invitedEmail,
      subject: `${inviterName} invited you to join their family on Fraydi`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You're invited to Fraydi</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 16px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #f96400; font-size: 28px; margin: 0;">Fraydi</h1>
      <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Family coordination, simplified</p>
    </div>

    <h2 style="color: #111827; font-size: 20px; margin: 0 0 12px;">You're invited! 🎉</h2>

    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      <strong>${inviterName}</strong> has invited you to join <strong>${familyName}</strong> on Fraydi — your family's AI-powered coordination hub.
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      With Fraydi, you can:
    </p>
    <ul style="color: #374151; font-size: 15px; line-height: 1.8; padding-left: 20px;">
      <li>Sync calendars across the whole family</li>
      <li>Coordinate schedules and avoid conflicts</li>
      <li>Track tasks, shopping, and routines</li>
      <li>Manage kids' activities and pickups</li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${joinUrl}"
         style="display: inline-block; background: #f96400; color: white; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 10px;">
        Join the family →
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 13px; text-align: center;">
      This invite expires in 7 days. If you didn't expect this, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #d1d5db; font-size: 12px; text-align: center; margin: 0;">
      Sent by Fraydi · fraydi.vercel.app
    </p>
  </div>
</body>
</html>
      `.trim(),
    })

    if (emailError) {
      console.error('[POST /api/family/invite] Resend error:', emailError)
      // Non-fatal: invitation was created, email failed
      return NextResponse.json(
        { invitation, token: invitation.token, emailError: emailError.message },
        { status: 207 }
      )
    }

    return NextResponse.json({ invitation, token: invitation.token }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/family/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/family/invite — list pending invites for current user's family
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
      return NextResponse.json({ invitations: [] })
    }

    const { data: invitations, error } = await db
      .from('family_invitations')
      .select('*')
      .eq('family_id', profile.family_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ invitations: invitations || [] })
  } catch (err) {
    console.error('[GET /api/family/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
