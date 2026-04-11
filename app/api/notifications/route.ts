/**
 * GET /api/notifications — get unread notifications for current user
 * PATCH /api/notifications?id=xxx — mark as read
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerSupabase()
  const { data: profile } = await db.from('profiles').select('id').eq('email', session.user.email).single()
  if (!profile?.id) return NextResponse.json({ notifications: [] })

  const { data: notifications } = await db
    .from('family_notifications')
    .select('*')
    .eq('recipient_profile_id', profile.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ notifications: notifications ?? [] })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const db = createServerSupabase()
  const { data: profile } = await db.from('profiles').select('id').eq('email', session.user.email).single()

  if (id) {
    await db.from('family_notifications').update({ read_at: new Date().toISOString() })
      .eq('id', id).eq('recipient_profile_id', profile?.id)
  } else {
    // Mark all as read
    await db.from('family_notifications').update({ read_at: new Date().toISOString() })
      .eq('recipient_profile_id', profile?.id).is('read_at', null)
  }

  return NextResponse.json({ ok: true })
}
