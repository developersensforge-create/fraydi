import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/coordination/assign — assign a driver to a calendar event
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event_id, assigned_to } = body

    if (!event_id || !assigned_to) {
      return NextResponse.json({ error: 'event_id and assigned_to are required' }, { status: 400 })
    }

    const db = createServerSupabase()

    // Get the current user's profile
    const { data: myProfile } = await db
      .from('profiles')
      .select('id, email, full_name, family_id')
      .eq('email', session.user.email)
      .single()

    if (!myProfile?.family_id) {
      return NextResponse.json({ error: 'No family found' }, { status: 404 })
    }

    // Get the event details
    const { data: event } = await db
      .from('calendar_events')
      .select('id, title, start_time')
      .eq('id', event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const eventTitle = event.title ?? 'the activity'
    const eventTime = event.start_time
      ? new Date(event.start_time).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'the scheduled time'

    const myName = myProfile.full_name || session.user.name || session.user.email || 'Your partner'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app'

    // Spouse lookup — find accepted non-me, non-kid family member
    const { data: famMember } = await db
      .from('family_members')
      .select('email')
      .eq('family_id', myProfile.family_id)
      .neq('role', 'me')
      .neq('role', 'kid')
      .eq('invite_status', 'accepted')
      .limit(1)
      .single()

    let spouseProfile: { id: string; email: string; full_name: string } | null = null
    if (famMember?.email) {
      const { data: sp } = await db
        .from('profiles')
        .select('id,email,full_name')
        .eq('email', famMember.email)
        .single()
      spouseProfile = sp ?? null
    }

    // Determine status based on assigned_to
    let status: 'pending' | 'confirmed' = 'confirmed'
    if (
      assigned_to !== myProfile.id &&
      assigned_to !== 'both' &&
      assigned_to !== 'none' &&
      spouseProfile &&
      assigned_to === spouseProfile.id
    ) {
      status = 'pending'
    }

    // Upsert the assignment
    const { data: assignment, error: upsertError } = await db
      .from('coordination_assignments')
      .upsert(
        {
          event_id,
          family_id: myProfile.family_id,
          assigned_to,
          assigned_by: myProfile.id,
          status,
        },
        { onConflict: 'event_id,family_id' }
      )
      .select()
      .single()

    if (upsertError || !assignment) {
      console.error('[POST /api/coordination/assign] upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save assignment' }, { status: 500 })
    }

    // --- Notification logic ---

    if (assigned_to === myProfile.id) {
      // I'm driving — notify spouse (info only)
      if (spouseProfile) {
        // In-app notification to spouse
        await db.from('family_notifications').insert({
          family_id: myProfile.family_id,
          recipient_profile_id: spouseProfile.id,
          type: 'assignment_info',
          title: 'Your partner is driving',
          body: `${myName} will drive to ${eventTitle} on ${eventTime}.`,
          action_url: `${appUrl}/dashboard`,
        })

        // Email to spouse
        await resend.emails.send({
          from: 'Fraydi <noreply@dayryz.com>',
          to: spouseProfile.email,
          subject: `No action needed — ${myName} is driving`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Driver confirmed</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;padding:40px;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#f96400;font-size:28px;margin:0;">Fraydi</h1>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Family coordination, simplified</p>
    </div>
    <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">✅ No action needed</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;">
      <strong>${myName}</strong> will drive to <strong>${eventTitle}</strong> on <strong>${eventTime}</strong>.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">
      You're all set — just sit back and enjoy the ride!
    </p>
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
    <p style="color:#d1d5db;font-size:12px;text-align:center;margin:0;">Sent by Fraydi · fraydi.vercel.app</p>
  </div>
</body>
</html>`.trim(),
        })
      }
    } else if (
      assigned_to !== 'both' &&
      assigned_to !== 'none' &&
      assigned_to !== myProfile.id &&
      spouseProfile &&
      assigned_to === spouseProfile.id
    ) {
      // Asking spouse to drive — send request
      const token = Buffer.from(`${assignment.id}:${myProfile.family_id}`).toString('base64')
      const confirmUrl = `${appUrl}/api/coordination/confirm?assignment_id=${assignment.id}&token=${token}`

      // In-app notification to spouse
      await db.from('family_notifications').insert({
        family_id: myProfile.family_id,
        recipient_profile_id: spouseProfile.id,
        type: 'assignment_request',
        title: 'Can you drive?',
        body: `${myName} is asking you to drive to ${eventTitle} on ${eventTime}.`,
        action_url: confirmUrl,
      })

      // Email to spouse with confirm button
      await resend.emails.send({
        from: 'Fraydi <noreply@dayryz.com>',
        to: spouseProfile.email,
        subject: `Can you drive? ${eventTitle}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Can you drive?</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;padding:40px;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#f96400;font-size:28px;margin:0;">Fraydi</h1>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">Family coordination, simplified</p>
    </div>
    <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">🚗 Can you drive?</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;">
      <strong>${myName}</strong> is asking you to drive to <strong>${eventTitle}</strong> on <strong>${eventTime}</strong>.
    </p>
    <div style="margin:28px 0;text-align:center;">
      <a href="${confirmUrl}"
         style="display:inline-block;background:#f96400;color:white;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;">
        ✅ Yes, I'll drive
      </a>
    </div>
    <p style="color:#9ca3af;font-size:13px;text-align:center;">
      Can't make it? Let ${myName} know directly.
    </p>
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
    <p style="color:#d1d5db;font-size:12px;text-align:center;margin:0;">Sent by Fraydi · fraydi.vercel.app</p>
  </div>
</body>
</html>`.trim(),
      })
    }
    // 'both' | 'none' → status already 'confirmed', no notification needed

    return NextResponse.json({ assignment }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/coordination/assign]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
