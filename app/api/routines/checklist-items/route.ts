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
  const routine_id = searchParams.get('routine_id')
  const family_member_id = searchParams.get('family_member_id')

  const supabase = createServerSupabase()
  let query = supabase
    .from('checklist_items')
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
    .order('created_at', { ascending: true })

  if (routine_id) query = query.eq('routine_id', routine_id)
  if (family_member_id) query = query.eq('family_member_id', family_member_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checklist_items: data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const body = await req.json()
  const { title, family_member_id, routine_id, source, equipment_id } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({
      family_id,
      family_member_id: family_member_id ?? null,
      routine_id: routine_id ?? null,
      title,
      is_checked: false,
      source: source ?? 'manual',
      equipment_id: equipment_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checklist_item: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const body = await req.json()
  const { id, is_checked, title } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (is_checked !== undefined) updates.is_checked = is_checked
  if (title !== undefined) updates.title = title

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('checklist_items')
    .update(updates)
    .eq('id', id)
    .eq('family_id', family_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checklist_item: data })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const family_id = await getFamilyId(session.user.email)
  if (!family_id) {
    return NextResponse.json({ error: 'No family found' }, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', id)
    .eq('family_id', family_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
