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

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const supabase = createServerSupabase()

  // Get all family members
  const { data: members, error: membersError } = await supabase
    .from('family_members')
    .select('id, name, role, color')
    .eq('family_id', family_id)
    .order('created_at', { ascending: true })

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  // Get all equipment for this family
  const { data: equipment, error: equipError } = await supabase
    .from('member_equipment')
    .select('id, name, description, remind_external_only, event_keywords, family_member_id')
    .eq('family_id', family_id)

  if (equipError) return NextResponse.json({ error: equipError.message }, { status: 500 })

  // Group equipment by family member
  const memberMap = new Map<string, {
    member: { id: string; name: string; role: string; color: string }
    equipment: Array<{ id: string; name: string; description: string | null; remind_external_only: boolean; event_keywords?: string[] }>
  }>()

  for (const m of (members ?? [])) {
    memberMap.set(m.id, {
      member: { id: m.id, name: m.name, role: m.role, color: m.color },
      equipment: [],
    })
  }

  for (const item of (equipment ?? [])) {
    const entry = memberMap.get(item.family_member_id)
    if (entry) {
      entry.equipment.push({
        id: item.id,
        name: item.name,
        description: item.description,
        remind_external_only: item.remind_external_only ?? false,
        event_keywords: (item as any).event_keywords ?? [],
      })
    }
  }

  // Return all members (including those with 0 items so they can add gear)
  const result = Array.from(memberMap.values())

  return NextResponse.json({ gear_summary: result })
}
