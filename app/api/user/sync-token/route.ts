import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// POST /api/user/sync-token
// Called on app load to ensure the current user's Google token is stored in DB
// This allows other family members to see the user's calendar
export async function POST() {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session?.user?.email || !session?.accessToken) {
      return NextResponse.json({ ok: false, reason: 'no session or token' })
    }

    const db = createServerSupabase()
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.id) {
      return NextResponse.json({ ok: false, reason: 'no profile' })
    }

    const expiresAt = session.accessTokenExpires
      ? new Date(session.accessTokenExpires as number).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    await db.from('google_calendar_tokens').upsert({
      profile_id: profile.id,
      access_token: session.accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sync-token]', err)
    return NextResponse.json({ ok: false, reason: 'error' })
  }
}
