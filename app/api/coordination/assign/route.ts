/**
 * POST /api/coordination/assign
 * Assign a kids event to a parent (or clear assignment)
 * Body: { event_id, assigned_to_profile_id | null }
 *
 * GET /api/coordination/assign?date=YYYY-MM-DD
 * Returns all assignments for the family on a given date
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { Resend } from 'resend'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerSupabase()
  const { data: myProfile } = await db.from('profiles').select('id, family_id').eq('email', session.user.email).single()
  if (!myProfile?.family_id) return NextResponse.json({ assignments: [] })

  const dateParam = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const dayStart = `${dateParam}T00:00:00Z`
  const dayEnd = `${dateParam}T23:59:59Z`

  // Use left join (not inner) — Google Calendar kid events may not be in calendar_events table
  // Filter by updated_at or just return all for the family and let frontend filter by event_id
  const { data: assignments } = await db
    .from('coordination_assignments')
    .select('id, event_id, assigned_to, assigned_by, status, family_id')
    .eq('family_id', myProfile.family_id)

  return NextResponse.json({ assignments: assignments ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event_id, assigned_to_profile_id } = await req.json()
  if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const db = createServerSupabase()
  const { data: myProfile } = await db.from('profiles').select('id, family_id, full_name').eq('email', session.user.email).single()
  if (!myProfile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 404 })

  // Get event details
  const { data: event } = await db.from('calendar_events').select('title, start_time').eq('id', event_id).single()

  // Upsert assignment
  if (!assigned_to_profile_id) {
    // Clear assignment
    await db.from('coordination_assignments').delete().eq('event_id', event_id).eq('family_id', myProfile.family_id)
    return NextResponse.json({ ok: true, cleared: true })
  }

  // 'I drive', 'both', or 'none' → confirmed immediately; spouse assign → pending (awaiting confirm)
  const isConfirmedImmediately = assigned_to_profile_id === myProfile.id ||
    assigned_to_profile_id === 'both' || assigned_to_profile_id === 'none'
  const assignStatus = isConfirmedImmediately ? 'confirmed' : 'pending'

  const { data: assignment } = await db.from('coordination_assignments').upsert({
    event_id,
    family_id: myProfile.family_id,
    assigned_to: assigned_to_profile_id,
    assigned_by: myProfile.id,
    status: assignStatus,
  }, { onConflict: 'event_id,family_id' }).select().single()

  // Notify assignee if it's someone else
  if (assigned_to_profile_id !== myProfile.id) {
    const { data: assignee } = await db.from('profiles').select('email, full_name').eq('id', assigned_to_profile_id).single()
    if (assignee?.email) {
      const eventTime = event?.start_time ? new Date(event.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app'

      // In-app notification
      await db.from('family_notifications').insert({
        family_id: myProfile.family_id,
        recipient_profile_id: assigned_to_profile_id,
        type: 'assignment_request',
        title: `You're on duty: ${event?.title ?? 'event'}`,
        body: `${(myProfile as any).full_name ?? 'Your partner'} assigned you to cover ${event?.title} on ${eventTime}`,
        action_url: `${appUrl}/dashboard`,
        reference_id: assignment?.id,
      })

      // Email notification
      await getResend().emails.send({
        from: process.env.FRAYDI_FROM_EMAIL ?? 'Fraydi <noreply@dayryz.com>',
        to: assignee.email,
        subject: `You're on duty: ${event?.title ?? 'an activity'}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#f96400">You've been assigned 👋</h2>
          <p>Hi ${assignee.full_name ?? 'there'},</p>
          <p><strong>${(myProfile as any).full_name ?? 'Your partner'}</strong> has assigned you to cover:</p>
          <div style="background:#fff7ed;border-left:4px solid #f96400;padding:12px 16px;border-radius:8px;margin:16px 0">
            <strong>${event?.title}</strong><br/>
            <span style="color:#666">${eventTime}</span>
          </div>
          <a href="${appUrl}/dashboard" style="display:inline-block;background:#f96400;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">View in Fraydi →</a>
        </div>`,
      }).catch(() => {}) // non-fatal
    }
  }

  return NextResponse.json({ ok: true, assignment })
}
