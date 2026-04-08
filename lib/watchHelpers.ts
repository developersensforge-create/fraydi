import { createServerSupabase } from '@/lib/supabaseServer'

type SupabaseClient = ReturnType<typeof createServerSupabase>

export async function resolveKeywords(
  db: SupabaseClient,
  sourceKeywords: string[] | null | undefined,
  familyId: string
): Promise<string[]> {
  if (sourceKeywords && sourceKeywords.length > 0) return sourceKeywords

  const { data } = await db
    .from('family_interests')
    .select('keywords')
    .eq('family_id', familyId)
    .single()

  return data?.keywords ?? []
}

export async function syncIcal(
  db: SupabaseClient,
  source: { id: string; url: string },
  userEmail: string,
  familyId: string
): Promise<number> {
  try {
    const fetchUrl = source.url.replace(/^webcal:\/\//i, 'https://')
    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return 0
    const icalText = await res.text()

    const events = parseIcal(icalText)
    if (!events.length) return 0

    const rows = events.map(e => ({
      watch_source_id: source.id,
      user_email: userEmail,
      family_id: familyId,
      title: e.title,
      description: e.description ?? null,
      event_date: e.start ? e.start.slice(0, 10) : null,
      event_time: e.start?.includes('T') ? formatTime(e.start) : null,
      location: e.location ?? null,
      url: e.url ?? null,
    }))

    await db.from('watch_events').delete().eq('watch_source_id', source.id)
    const { error } = await db.from('watch_events').insert(rows)
    if (error) {
      console.error('[syncIcal] insert error:', error)
      return 0
    }

    await db
      .from('watch_sources')
      .update({ last_synced_at: new Date().toISOString(), event_count: rows.length })
      .eq('id', source.id)

    return rows.length
  } catch (e) {
    console.error('[syncIcal] error:', e)
    return 0
  }
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    const h = d.getUTCHours()
    const m = d.getUTCMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
  } catch {
    return ''
  }
}

export function parseIcal(text: string): Array<{
  title: string; start: string; end?: string;
  description?: string; url?: string; location?: string
}> {
  const events: Array<{
    title: string; start: string; end?: string;
    description?: string; url?: string; location?: string
  }> = []
  const blocks = text.split('BEGIN:VEVENT')
  for (const block of blocks.slice(1)) {
    const get = (key: string): string => {
      const match = block.match(new RegExp(key + '[^:]*:([^\\r\\n]+)'))
      return match?.[1]?.trim() ?? ''
    }
    const parseIcalDate = (str: string): string => {
      const clean = str.replace(/[^0-9T]/g, '')
      if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
      }
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`
    }
    const summary = get('SUMMARY')
    const dtstart = get('DTSTART')
    if (!summary || !dtstart) continue
    events.push({
      title: summary,
      start: parseIcalDate(dtstart),
      end: get('DTEND') ? parseIcalDate(get('DTEND')) : undefined,
      description: get('DESCRIPTION') || undefined,
      url: get('URL') || undefined,
      location: get('LOCATION') || undefined,
    })
  }
  return events
}
