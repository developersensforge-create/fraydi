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

    // Build upsert — always update access_token and expires_at
    // Only update refresh_token if we have one (don't overwrite existing with null)
    const upsertData: Record<string, unknown> = {
      profile_id: profile.id,
      access_token: session.accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
    if (session.refreshToken) {
      upsertData.refresh_token = session.refreshToken
    }

    await db.from('google_calendar_tokens').upsert(upsertData, { onConflict: 'profile_id' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sync-token]', err)
    return NextResponse.json({ ok: false, reason: 'error' })
  }
}
