/**
 * POST /api/coordination/switch
 * Request to switch an assignment to the other parent
 * Body: { assignment_id }
 *
 * PATCH /api/coordination/switch/[id] — accept or decline
 * Body: { action: 'accept' | 'decline' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { assignment_id } = await req.json()
  if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })

  const db = createServerSupabase()
  const { data: myProfile } = await db.from('profiles').select('id, family_id, full_name').eq('email', session.user.email).single()
  if (!myProfile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  // Get assignment + event details
  const { data: assignment } = await db
    .from('coordination_assignments')
    .select('*, calendar_events(title, start_time)')
    .eq('id', assignment_id)
    .eq('family_id', myProfile.family_id)
    .single()

  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  // The "other parent" is assigned_by if I'm assigned_to, or vice versa
  const otherProfileId = assignment.assigned_to === myProfile.id ? assignment.assigned_by : assignment.assigned_to
  if (!otherProfileId) return NextResponse.json({ error: 'No other parent found' }, { status: 400 })

  // Create switch request
  const { data: switchReq } = await db.from('assignment_switch_requests').insert({
    assignment_id,
    family_id: myProfile.family_id,
    requested_by: myProfile.id,
    requested_to: otherProfileId,
    event_id: assignment.event_id,
    status: 'pending',
  }).select().single()

  const event = (assignment as any).calendar_events
  const eventTime = event?.start_time ? new Date(event.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app'

  // Get other parent's details
  const { data: otherParent } = await db.from('profiles').select('email, full_name').eq('id', otherProfileId).single()

  // In-app notification
  await db.from('family_notifications').insert({
    family_id: myProfile.family_id,
    recipient_profile_id: otherProfileId,
    type: 'switch_request',
    title: `Switch request: ${event?.title ?? 'event'}`,
    body: `${(myProfile as any).full_name ?? 'Your partner'} is asking you to take over ${event?.title} on ${eventTime}`,
    action_url: `${appUrl}/dashboard?switch=${switchReq?.id}`,
    reference_id: switchReq?.id,
  })

  // Email notification
  if (otherParent?.email) {
    const acceptUrl = `${appUrl}/api/coordination/switch/respond?id=${switchReq?.id}&action=accept&token=${switchReq?.id}`
    const declineUrl = `${appUrl}/api/coordination/switch/respond?id=${switchReq?.id}&action=decline&token=${switchReq?.id}`

    await getResend().emails.send({
      from: process.env.FRAYDI_FROM_EMAIL ?? 'Fraydi <noreply@dayryz.com>',
      to: otherParent.email,
      subject: `Switch request: ${event?.title ?? 'an activity'}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#f96400">Switch Request 🔄</h2>
        <p>Hi ${otherParent.full_name ?? 'there'},</p>
        <p><strong>${(myProfile as any).full_name ?? 'Your partner'}</strong> is asking you to take over:</p>
        <div style="background:#fff7ed;border-left:4px solid #f96400;padding:12px 16px;border-radius:8px;margin:16px 0">
          <strong>${event?.title}</strong><br/>
          <span style="color:#666">${eventTime}</span>
        </div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <a href="${acceptUrl}" style="flex:1;text-align:center;background:#22c55e;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold">✓ Accept</a>
          <a href="${declineUrl}" style="flex:1;text-align:center;background:#ef4444;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold">✗ Decline</a>
        </div>
        <p style="margin-top:16px"><a href="${appUrl}/dashboard" style="color:#f96400">Or respond in the app →</a></p>
      </div>`,
    }).catch(() => {})

    await db.from('assignment_switch_requests').update({ email_sent_at: new Date().toISOString() }).eq('id', switchReq?.id)
  }

  return NextResponse.json({ ok: true, switch_request: switchReq })
}
