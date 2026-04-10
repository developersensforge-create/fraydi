import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

export async function GET(req: NextRequest) {
  const family_id = req.nextUrl.searchParams.get('family_id')
  if (!family_id) {
    return NextResponse.json({ error: 'family_id required' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('watch_sources')
    .select('*')
    .eq('family_id', family_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as { user?: { email?: string } } | null
  const userEmail = session?.user?.email ?? null

  const body = await req.json()
  const { family_id, name, type, url, color } = body

  if (!family_id || !name || !type) {
    return NextResponse.json({ error: 'family_id, name, and type are required' }, { status: 400 })
  }

  if (!['ical_url', 'manual'].includes(type)) {
    return NextResponse.json({ error: 'type must be ical_url or manual' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('watch_sources')
    .insert({ family_id, name, type, url: url ?? null, color: color ?? '#6366f1', user_email: userEmail })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data }, { status: 201 })
}
