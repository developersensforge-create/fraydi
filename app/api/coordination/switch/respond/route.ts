/**
 * GET /api/coordination/switch/respond?id=xxx&action=accept|decline&token=xxx
 * Email link handler — accepts or declines a switch request
 * Also used by in-app PATCH with body: { id, action }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const action = req.nextUrl.searchParams.get('action')
  if (!id || !action) return NextResponse.redirect(new URL('/dashboard', req.url))
  return handleResponse(id, action, req)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })
  return handleResponse(id, action, req)
}

async function handleResponse(id: string, action: string, req: NextRequest) {
  const db = createServerSupabase()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fraydi.vercel.app'

  const { data: switchReq } = await db
    .from('assignment_switch_requests')
    .select('*, assignment_id, family_id, requested_by, requested_to, event_id')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (!switchReq) {
    const isGet = req.method === 'GET'
    return isGet
      ? NextResponse.redirect(new URL('/dashboard?switch_result=already_handled', req.url))
      : NextResponse.json({ error: 'Request not found or already handled' }, { status: 404 })
  }

  const accepted = action === 'accept'

  // Update switch request status
  await db.from('assignment_switch_requests').update({
    status: accepted ? 'accepted' : 'declined',
    responded_at: new Date().toISOString(),
  }).eq('id', id)

  if (accepted) {
    // Reassign: swap assigned_to from requester to responder
    await db.from('coordination_assignments').update({
      assigned_to: switchReq.requested_to,
      assigned_by: switchReq.requested_to,
      status: 'confirmed',
    }).eq('id', switchReq.assignment_id)
  }

  // Notify the requester of the response
  await db.from('family_notifications').insert({
    family_id: switchReq.family_id,
    recipient_profile_id: switchReq.requested_by,
    type: accepted ? 'switch_accepted' : 'switch_declined',
    title: accepted ? 'Switch request accepted ✓' : 'Switch request declined ✗',
    body: accepted ? 'Your partner accepted the switch.' : 'Your partner declined — you\'re still on duty.',
    action_url: `${appUrl}/dashboard`,
    reference_id: id,
  })

  // Also mark any in-app notification for the responder as read
  await db.from('family_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('reference_id', id)
    .eq('recipient_profile_id', switchReq.requested_to)

  if (req.method === 'GET') {
    return NextResponse.redirect(new URL(`/dashboard?switch_result=${accepted ? 'accepted' : 'declined'}`, req.url))
  }
  return NextResponse.json({ ok: true, accepted })
}
