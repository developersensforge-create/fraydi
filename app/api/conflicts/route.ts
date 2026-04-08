import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface CalEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  profile_id: string
  family_id: string
  location?: string | null
}

interface Conflict {
  type: 'overlap' | 'no_coverage'
  event1: CalEvent
  event2: CalEvent
  date: string
  suggestedResolution: string
}

function eventsOverlap(a: CalEvent, b: CalEvent): boolean {
  const aStart = new Date(a.start_time).getTime()
  const aEnd = new Date(a.end_time).getTime()
  const bStart = new Date(b.start_time).getTime()
  const bEnd = new Date(b.end_time).getTime()
  return aStart < bEnd && bStart < aEnd
}

async function generateResolution(event1: CalEvent, event2: CalEvent, type: string): Promise<string> {
  try {
    const prompt =
      type === 'no_coverage'
        ? `Two family members both have events at the same time: "${event1.title}" and "${event2.title}". Suggest a brief resolution (1-2 sentences) for who should handle coverage or how to coordinate.`
        : `Two calendar events overlap: "${event1.title}" and "${event2.title}". Suggest a brief resolution (1-2 sentences) to resolve this scheduling conflict.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful family scheduler. Give short, practical, friendly suggestions.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 80,
      temperature: 0.7,
    })

    return response.choices[0]?.message?.content?.trim() || 'Consider rescheduling one of these events.'
  } catch {
    return 'Consider rescheduling or delegating one of these commitments.'
  }
}

// GET /api/conflicts?date=YYYY-MM-DD&days=7&tz=America/New_York
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const startDate = new Date(`${dateParam}T00:00:00Z`)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + days)

    const db = createServerSupabase()

    // Get user's profile and family
    const { data: profile } = await db
      .from('profiles')
      .select('id, family_id')
      .eq('email', session.user.email)
      .single()

    if (!profile?.family_id) {
      return NextResponse.json({ conflicts: [] })
    }

    // Fetch all calendar events for this family in the date range
    const { data: events, error } = await db
      .from('calendar_events')
      .select('id, title, start_time, end_time, profile_id, family_id, location')
      .eq('family_id', profile.family_id)
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allEvents: CalEvent[] = events || []
    const conflicts: Conflict[] = []

    // Detect overlapping events between different profiles
    for (let i = 0; i < allEvents.length; i++) {
      for (let j = i + 1; j < allEvents.length; j++) {
        const a = allEvents[i]
        const b = allEvents[j]

        // Only flag conflicts between different people
        if (a.profile_id === b.profile_id) continue

        if (eventsOverlap(a, b)) {
          const date = a.start_time.slice(0, 10)
          const resolution = await generateResolution(a, b, 'overlap')
          conflicts.push({
            type: 'overlap',
            event1: a,
            event2: b,
            date,
            suggestedResolution: resolution,
          })
        }
      }
    }

    return NextResponse.json({ conflicts })
  } catch (err) {
    console.error('[GET /api/conflicts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
