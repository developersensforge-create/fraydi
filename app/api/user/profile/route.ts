import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/user/profile — returns the current user's profile (family_id etc.)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerSupabase()
    const { data: profile, error } = await db
      .from('profiles')
      .select('id, family_id, full_name, email')
      .eq('email', session.user.email)
      .single()

    if (error || !profile) {
      return NextResponse.json({ family_id: null })
    }

    return NextResponse.json({ id: profile.id, family_id: profile.family_id ?? null, name: (profile as any).full_name, email: profile.email })
  } catch (err) {
    console.error('[GET /api/user/profile]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
