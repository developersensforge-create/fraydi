import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export type ScrapedEvent = {
  title: string
  description?: string
  event_date?: string  // YYYY-MM-DD
  event_time?: string  // e.g. "2:00 PM"
  location?: string
  url?: string
  price?: string       // e.g. "Free", "$10", "$5–$15/session"
  tags?: string[]      // e.g. ["kids", "outdoor", "free"]
  relevance_score?: number
}

/** Normalize known recreation site URL patterns to their best scrape-able endpoint */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // myrec.com: activities.aspx is a JS shell — the list page is default.aspx?type=activities
    if (u.hostname.includes('myrec.com') && u.pathname.includes('activities.aspx')) {
      return `${u.origin}${u.pathname.replace('activities.aspx', 'default.aspx')}?type=activities`
    }
  } catch {}
  return url
}

function parseDate(mmddyyyy: string): string | null {
  const m = mmddyyyy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
}

function parseTime(text: string): string | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i)
  if (!m) return null
  return `${m[1]}:${m[2]} ${m[3].toUpperCase()}`
}

/** For myrec.com: extract all programs as structured events directly from HTML */
async function scrapeMyrec(baseUrl: string): Promise<ScrapedEvent[]> {
  try {
    const u = new URL(baseUrl)
    const origin = u.origin + '/info/activities'

    const listRes = await fetch(`${origin}/default.aspx?type=activities`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fraydi/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!listRes.ok) return []
    const listHtml = await listRes.text()

    // Extract all program IDs + names from list page
    const programEntries: Array<{ id: string; title: string }> = []
    const entryRe = /href="[^"]*program_details\.aspx\?ProgramID=(\d+)[^"]*"[^>]*>\s*([^<]{3,80})/gi
    let match
    const seen = new Set<string>()
    while ((match = entryRe.exec(listHtml)) !== null) {
      const pid = match[1]
      if (seen.has(pid)) continue
      seen.add(pid)
      programEntries.push({ id: pid, title: match[2].trim() })
    }
    if (!programEntries.length) return []

    // Fetch all detail pages
    const results = await Promise.all(
      programEntries.slice(0, 29).map(async ({ id, title }) => {
        try {
          const res = await fetch(`${origin}/program_details.aspx?ProgramID=${id}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fraydi/1.0)' },
            signal: AbortSignal.timeout(8000),
          })
          if (!res.ok) return null
          const html = await res.text()
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')

          // Extract dates (MM/DD/YYYY)
          const allDates = [...text.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g)].map(m => m[1])
          const futureDates = allDates
            .map(d => parseDate(d))
            .filter((d): d is string => d !== null && d >= new Date().toISOString().split('T')[0])
          const nextDate = futureDates[0] ?? null

          // Extract prices
          const priceMatch = text.match(/\$([\d,.]+)\s*(Res(?:ident)?)?/)
          const price = priceMatch
            ? (parseFloat(priceMatch[1]) === 0 ? 'Free' : `$${priceMatch[1]}`)
            : null

          // Extract time
          const eventTime = parseTime(text)

          // Extract location — look for "Location:" or "Facility:" patterns
          const locMatch = text.match(/(?:Location|Facility|Held at)[:\s]+([A-Z][^.|\n]{5,60})/)
          const location = locMatch ? locMatch[1].trim() : null

          // Extract description — first meaningful sentence after nav
          const descMatch = text.match(/(?:Activity|Program|Description)[:\s]+([A-Z][^.!?]{20,200}[.!?])/)
          const description = descMatch ? descMatch[1].trim() : null

          if (!nextDate && !price && !eventTime) return null // skip programs with no useful data

          const ev: ScrapedEvent = {
            title,
            description: description ?? undefined,
            event_date: nextDate ?? undefined,
            event_time: eventTime ?? undefined,
            location: location ?? undefined,
            url: `${origin}/program_details.aspx?ProgramID=${id}`,
            price: price ?? undefined,
            tags: [],
            relevance_score: 3,
          }
          return ev
        } catch { return null }
      })
    )

    return results.filter((r): r is ScrapedEvent => r !== null)
  } catch { return [] }
}

export async function scrapeEventsFromUrl(
  url: string,
  interestKeywords: string[] = []
): Promise<ScrapedEvent[]> {
  // Step 1: Fetch the page content — use structured scraper for known platforms
  try {
    // myrec.com: structured per-program extraction, no AI needed
    if (url.includes('myrec.com')) {
      return await scrapeMyrec(url)
    }
  } catch (e) {
    console.error('[aiScraper] myrec scrape failed:', e)
    return []
  }

  let pageText = ''
  try {
    {
      const fetchUrl = normalizeUrl(url)
      const res = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fraydi/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      pageText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
    }
  } catch (e) {
    console.error('[aiScraper] fetch failed:', e)
    return []
  }

  if (!pageText || pageText.length < 50) return []

  // Build keyword-aware system prompt
  const keywordClause =
    interestKeywords.length > 0
      ? ` Prioritize events matching these interest keywords: ${interestKeywords.join(', ')}. Score each event's relevance 1-5 and include it as a "relevance_score" field. Filter out events with score < 2 unless no events score higher.`
      : ' Include a "relevance_score" field (1-5) for each event based on general family-friendliness.'

  // Step 2: Ask GPT-4o-mini to extract events
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `You are an event extractor for a family calendar app. Extract all events, activities, programs, or classes from the provided webpage text. Focus on family-friendly events: kids activities, sports, community events, classes, festivals, workshops.` +
            keywordClause +
            ` Return JSON array only. Each event: { title, description (brief, 1 sentence max), event_date (YYYY-MM-DD or null), event_time (e.g. "2:00 PM" or null), location (or null), url (if found, or null), price (e.g. "Free", "$10", "$5/session", or null if unknown), tags (array of 2-4 short lowercase keywords like ["kids","outdoor","free","sports"] or []), relevance_score (1-5) }. If no events found, return []. Return only valid JSON, no markdown.`,
        },
        {
          role: 'user',
          content: `Extract events from this webpage:\n\n${pageText}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]'
    // Strip markdown code fences if present
    const json = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    const events: ScrapedEvent[] = JSON.parse(json)
    if (!Array.isArray(events)) return []

    // Apply relevance filter when keywords are provided
    if (interestKeywords.length > 0) {
      const scored = events.filter(e => (e.relevance_score ?? 1) >= 2)
      // If nothing passes the threshold, return all (GPT said none scored higher)
      return (scored.length > 0 ? scored : events).slice(0, 30)
    }

    return events.slice(0, 30)
  } catch (e) {
    console.error('[aiScraper] GPT parse failed:', e)
    return []
  }
}
