import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'

// PATCH /api/tasks/[id] — mark done, reassign, or update
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { is_done, assigned_to_email, title, description, due_date } = body

    const db = createServerSupabase()

    // Verify the task belongs to the user's family
    const { data: profile } = await db
      .from('profiles')
      .select('id, family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: existingTask } = await db
      .from('todos')
      .select('id, family_id')
      .eq('id', id)
      .single()

    if (!existingTask || existingTask.family_id !== profile.family_id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (typeof is_done === 'boolean') updates.is_done = is_done
    if (title !== undefined) updates.title = title.trim()
    if (description !== undefined) updates.description = description
    if (due_date !== undefined) updates.due_date = due_date

    // Resolve assignee if email provided
    if (assigned_to_email !== undefined) {
      if (!assigned_to_email) {
        updates.assigned_to = null
      } else {
        const { data: assignee } = await db
          .from('profiles')
          .select('id')
          .eq('email', assigned_to_email)
          .eq('family_id', profile.family_id)
          .single()
        updates.assigned_to = assignee?.id || null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: task, error } = await db
      .from('todos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (err) {
    console.error('[PATCH /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id] — delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const db = createServerSupabase()

    const { data: profile } = await db
      .from('profiles')
      .select('family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: existingTask } = await db
      .from('todos')
      .select('id, family_id')
      .eq('id', id)
      .single()

    if (!existingTask || existingTask.family_id !== profile.family_id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const { error } = await db.from('todos').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
