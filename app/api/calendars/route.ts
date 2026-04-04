import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/calendars?family_id=xxx  — list all calendar sources for a family
// POST /api/calendars               — add a new calendar source (saves URL, triggers first import)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const family_id = searchParams.get('family_id')

    if (!family_id) {
      return NextResponse.json({ error: 'family_id query parameter is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('calendar_sources')
      .select('*')
      .eq('family_id', family_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ calendars: data ?? [] })
  } catch (err) {
    console.error('[GET /api/calendars] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ical_url, profile_id, family_id, name, color } = body

    if (!ical_url || !profile_id || !family_id || !name) {
      return NextResponse.json(
        { error: 'ical_url, profile_id, family_id, and name are required' },
        { status: 400 }
      )
    }

    // Insert the calendar source
    const { data: source, error: insertError } = await supabase
      .from('calendar_sources')
      .insert({
        profile_id,
        family_id,
        name,
        ical_url,
        color: color || '#f96400',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Trigger the first import
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const importResponse = await fetch(`${baseUrl}/api/calendar/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ical_url, profile_id, family_id, calendar_name: name, color }),
    })

    const importResult = await importResponse.json()

    return NextResponse.json({
      calendar: source,
      import: importResult,
    })
  } catch (err) {
    console.error('[POST /api/calendars] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
