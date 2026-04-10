import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

// GET /api/family/members — list family members with child links
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
      return NextResponse.json({ members: [] })
    }

    const { data: members, error } = await db
      .from('family_members')
      .select('*, member_child_links(child_id)')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ members: members || [] })
  } catch (err) {
    console.error('[GET /api/family/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/family/members — create member, send invite email, create child links
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, role, child_ids } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const validRoles = ['spouse', 'co-parent', 'grandparent', 'caregiver', 'other']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Role must be one of: spouse, co-parent, grandparent, caregiver, other' },
        { status: 400 }
      )
    }

    const db = createServerSupabase()

    // Look up inviter profile and family
    const { data: profile } = await db
      .from('profiles')
      .select('*, families(name)')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    // Generate invite token
    const invite_token = crypto.randomBytes(24).toString('hex')
    const invite_status = email ? 'pending' : 'not_invited'

    const { data: member, error: memberError } = await db
      .from('family_members')
      .insert({
        family_id: profile.family_id,
        name: name.trim(),
        email: email || null,
        role,
        invite_token,
        invite_status,
        calendar_access: 'none',
        is_account_holder: false,
      })
      .select()
      .single()

    if (memberError || !member) {
      console.error('[POST /api/family/members] insert error:', memberError)
      return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
    }

    // Create child links if provided
    if (Array.isArray(child_ids) && child_ids.length > 0) {
      const links = child_ids.map((child_id: string) => ({
        family_member_id: member.id,
        child_id,
      }))
      const { error: linkError } = await db.from('member_child_links').insert(links)
      if (linkError) {
        console.error('[POST /api/family/members] child link error:', linkError)
      }
    }

    // Send invite email if email provided
    let emailError: string | null = null
    if (email) {
      const inviterName = profile.full_name || session.user.name || session.user.email
      const familyData = profile.families as { name?: string } | null
      const familyName = familyData?.name || 'their family'
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fraydi.vercel.app'
      const fullAccessUrl = `${baseUrl}/invite/${invite_token}?access=full`
      const busyOnlyUrl = `${baseUrl}/invite/${invite_token}?access=busy_only`
      const declineUrl = `${baseUrl}/invite/${invite_token}/decline`

      const { error: resendError } = await resend.emails.send({
        from: 'Fraydi <noreply@dayryz.com>',
        to: email,
        subject: `${inviterName} invited you to coordinate on Fraydi`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You're invited to coordinate on Fraydi</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;padding:40px;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#f96400;font-size:28px;margin:0;">Fraydi</h1>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Family coordination, simplified</p>
    </div>

    <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">You're invited to coordinate 🎉</h2>

    <p style="color:#374151;font-size:16px;line-height:1.6;">
      <strong>${inviterName}</strong> has invited you to coordinate for the <strong>${familyName}</strong> family on Fraydi as a <strong>${role}</strong>.
    </p>

    <p style="color:#374151;font-size:15px;line-height:1.6;">
      Choose how much calendar access to share:
    </p>

    <div style="margin:28px 0;">
      <a href="${fullAccessUrl}"
         style="display:block;background:#f96400;color:white;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;text-align:center;margin-bottom:12px;">
        📅 Share full calendar
      </a>
      <a href="${busyOnlyUrl}"
         style="display:block;background:#fef3ec;color:#f96400;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;text-align:center;border:2px solid #f96400;">
        🕐 Share availability only (busy/free)
      </a>
    </div>

    <p style="color:#9ca3af;font-size:13px;text-align:center;">
      Don't want to join?
      <a href="${declineUrl}" style="color:#9ca3af;">Decline this invitation</a>
    </p>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
    <p style="color:#d1d5db;font-size:12px;text-align:center;margin:0;">
      Sent by Fraydi · fraydi.vercel.app
    </p>
  </div>
</body>
</html>`.trim(),
      })

      if (resendError) {
        console.error('[POST /api/family/members] Resend error:', resendError)
        emailError = resendError.message
      }
    }

    return NextResponse.json(
      { member, emailError },
      { status: emailError ? 207 : 201 }
    )
  } catch (err) {
    console.error('[POST /api/family/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
