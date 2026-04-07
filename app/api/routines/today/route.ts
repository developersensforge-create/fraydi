import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
)

type Routine = {
  id: string
  family_id: string
  assigned_to: string | null
  title: string
  description: string | null
  recurrence: 'daily' | 'weekly' | 'monthly'
  days_of_week: number[]
  time_of_day: string | null
  reminder_minutes_before: number
  active: boolean
  created_at: string
}

function routineAppliesToday(routine: Routine, date: Date): boolean {
  const dow = date.getDay() // 0=Sun
  if (routine.recurrence === 'daily') return true
  if (routine.recurrence === 'weekly') return routine.days_of_week?.includes(dow) ?? false
  if (routine.recurrence === 'monthly') return routine.days_of_week?.includes(date.getDate()) ?? false
  return false
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const family_id = searchParams.get('family_id')
  const dateStr = searchParams.get('date') // YYYY-MM-DD

  if (!family_id) {
    return NextResponse.json({ error: 'family_id required' }, { status: 400 })
  }

  const targetDate = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('routines')
    .select('*')
    .eq('family_id', family_id)
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const todayRoutines = (data as Routine[]).filter((r) => routineAppliesToday(r, targetDate))

  return NextResponse.json({ routines: todayRoutines, date: targetDate.toISOString().split('T')[0] })
}
