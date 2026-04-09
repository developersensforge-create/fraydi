import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

async function getFamilyId(email: string): Promise<string | null> {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('email', email)
    .single()
  return data?.family_id ?? null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const dateStr = searchParams.get('date') // YYYY-MM-DD optional

  const targetDate = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const todayDow = targetDate.getDay() // 0=Sun

  const supabase = createServerSupabase()

  // Fetch all active routines for this family with member info
  const { data: routines, error: routinesError } = await supabase
    .from('routines')
    .select(`
      *,
      family_members (
        id,
        name,
        role,
        color
      )
    `)
    .eq('family_id', family_id)
    .eq('active', true)

  if (routinesError) return NextResponse.json({ error: routinesError.message }, { status: 500 })

  // Filter routines relevant for today
  const todayRoutines = (routines ?? []).filter((r) => {
    if (r.frequency === 'daily') return true
    if (r.frequency === 'weekly') return Array.isArray(r.days_of_week) && r.days_of_week.includes(todayDow)
    if (r.frequency === 'before_event') return true // always surface; event-specific logic handled on frontend
    return false
  })

  // Fetch gear reminders from member_equipment (only non-external reminders)
  const { data: equipment, error: equipError } = await supabase
    .from('member_equipment')
    .select(`
      id,
      name,
      description,
      remind_external_only,
      family_member_id,
      family_members (
        id,
        name,
        role,
        color
      )
    `)
    .eq('family_id', family_id)
    .eq('remind_external_only', false)

  if (equipError) return NextResponse.json({ error: equipError.message }, { status: 500 })

  const gearReminders = (equipment ?? []).map((item: any) => ({
    type: 'gear' as const,
    id: item.id,
    item_name: item.name,
    description: item.description,
    member_name: item.family_members?.name ?? null,
    family_member_id: item.family_member_id,
  }))

  return NextResponse.json({
    routines: todayRoutines,
    gear_reminders: gearReminders,
    date: targetDate.toISOString().split('T')[0],
  })
}
