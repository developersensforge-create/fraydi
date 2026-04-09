import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createServerSupabase } from '@/lib/supabaseServer'
import { scrapeEventsFromUrl } from '@/lib/aiScraper'
import { resolveKeywords, syncIcal } from '@/lib/watchHelpers'

type SupabaseClient = ReturnType<typeof createServerSupabase>

async function getOrCreateProfile(db: SupabaseClient, email: string) {
  let { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (!profile) {
    const { data: newProfile } = await db
      .from('profiles')
      .insert({ id: crypto.randomUUID(), email, role: 'member', color: '#f96400' })
      .select()
      .single()
    profile = newProfile
  }
  return profile
}

// GET /api/watch/sources — list all watch sources for current user's family
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerSupabase()
  const profile = await getOrCreateProfile(db, session.user.email)

  if (!profile?.family_id) {
    return NextResponse.json({ sources: [] })
  }

  const { data, error } = await db
    .from('watch_sources')
    .select('*')
    .eq('family_id', profile.family_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data })
}

// POST /api/watch/sources — create a new watch source and trigger initial sync
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userEmail = session.user.email

  const body = await req.json()
  const { name, url, type = 'url', color = '#6366f1', interest_keywords } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createServerSupabase()
  const profile = await getOrCreateProfile(db, userEmail)

  if (!profile?.family_id) {
    return NextResponse.json(
      { error: 'No family found. Please create or join a family first.' },
      { status: 400 }
    )
  }

  const { data: source, error } = await db
    .from('watch_sources')
    .insert({
      user_email: userEmail,
      family_id: profile.family_id,
      name,
      url: url ?? null,
      type,
      color,
      interest_keywords: interest_keywords ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget the scrape/sync — return immediately so UI doesn't time out
  // The source will be synced in the background; user can hit "Sync now" to check results
  if (type === 'url' && url) {
    resolveKeywords(db, interest_keywords, profile.family_id).then(keywords =>
      scrapeEventsFromUrl(url, keywords).then(scraped => {
        if (scraped.length > 0) {
          const rows = scraped.map(e => ({
            watch_source_id: source.id,
            user_email: userEmail,
            family_id: profile.family_id,
            title: e.title,
            description: e.description ?? null,
            event_date: e.event_date ?? null,
            event_time: e.event_time ?? null,
            location: e.location ?? null,
            url: e.url ?? null,
          }))
          db.from('watch_events').insert(rows).then(() =>
            db.from('watch_sources').update({ last_synced_at: new Date().toISOString(), event_count: scraped.length }).eq('id', source.id)
          )
        }
      })
    ).catch(() => {})
  } else if (type === 'ical' && url) {
    syncIcal(db, { id: source.id, url }, userEmail, profile.family_id).catch(() => {})
  }

  return NextResponse.json({ source, events_found: 0, syncing: true }, { status: 201 })
}
