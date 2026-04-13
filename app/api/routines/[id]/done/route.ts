import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// PATCH /api/routines/[id]/done — toggle done for today
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { done } = await req.json()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const db = createServerSupabase()
  const { data: routine } = await db.from('family_routines').select('done_dates').eq('id', params.id).single()
  if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dates: string[] = Array.isArray(routine.done_dates) ? routine.done_dates : []
  const updated = done
    ? [...new Set([...dates, today])]
    : dates.filter(d => d !== today)

  await db.from('family_routines').update({ done_dates: updated }).eq('id', params.id)
  return NextResponse.json({ ok: true, done })
}
