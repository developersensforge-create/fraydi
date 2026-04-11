import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// GET /api/tasks — returns todos for current family
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ tasks: [] })
    }

    const { data: tasks, error } = await db
      .from('todos')
      .select('*')
      .eq('family_id', profile.family_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: tasks || [] })
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks — create a todo
// Body: { title: string, assigned_to_email?: string, due_date?: string, description?: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, assigned_to_email, due_date, description } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('id, family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'You must be in a family to create tasks' }, { status: 400 })
    }

    // Resolve assignee if email provided
    let assignedToId: string | null = null
    if (assigned_to_email) {
      const { data: assignee } = await db
        .from('profiles')
        .select('id')
        .eq('email', assigned_to_email)
        .eq('family_id', profile.family_id)
        .single()
      assignedToId = assignee?.id || null
    }

    const { data: task, error } = await db
      .from('todos')
      .insert({
        family_id: profile.family_id,
        created_by: profile.id,
        assigned_to: assignedToId,
        title: title.trim(),
        description: description || null,
        due_date: due_date || null,
        is_done: false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
