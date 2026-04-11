import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('assignment_id')
  const token = req.nextUrl.searchParams.get('token')
  if (!id || !token) return new NextResponse('Invalid link', { status: 400 })

  const db = createServerSupabase()
  const { data: a } = await db
    .from('coordination_assignments')
    .select('id,family_id,assigned_by,event_id')
    .eq('id', id)
    .single()
  if (!a) return new NextResponse('Not found', { status: 404 })

  const expected = Buffer.from(`${id}:${a.family_id}`).toString('base64')
  if (token !== expected) return new NextResponse('Invalid token', { status: 403 })

  await db.from('coordination_assignments').update({ status: 'confirmed' }).eq('id', id)

  // Get event + assigner name for notification
  const { data: ev } = await db
    .from('calendar_events')
    .select('title')
    .eq('id', a.event_id)
    .single()
  const { data: assigner } = await db
    .from('profiles')
    .select('id,full_name')
    .eq('id', a.assigned_by)
    .single()
  const { data: confirmer } = await db
    .from('profiles')
    .select('full_name')
    .eq('family_id', a.family_id)
    .neq('id', a.assigned_by)
    .single()

  if (assigner?.id) {
    await db.from('family_notifications').insert({
      family_id: a.family_id,
      recipient_profile_id: assigner.id,
      type: 'assignment_confirmed',
      title: 'Driver confirmed!',
      body: `${confirmer?.full_name ?? 'Your partner'} confirmed they'll drive to ${ev?.title ?? 'the activity'}.`,
      action_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app'}/dashboard`,
    })
  }

  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>✅ Confirmed!</h1><p>You're on driving duty for <strong>${ev?.title ?? 'the activity'}</strong>.</p><p>Your partner has been notified.</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
