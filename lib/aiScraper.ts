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

/** For myrec.com: extract program IDs from the list page, then fetch each detail page */
async function scrapeMyrec(baseUrl: string): Promise<string> {
  try {
    const u = new URL(baseUrl)
    const origin = u.origin + '/info/activities'

    // Fetch the list page
    const listRes = await fetch(`${origin}/default.aspx?type=activities`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fraydi/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!listRes.ok) return ''
    const listHtml = await listRes.text()

    // Extract all unique ProgramIDs from links like: program_details.aspx?ProgramID=29848
    const programIds = [...new Set([...listHtml.matchAll(/program_details\.aspx\?ProgramID=(\d+)/g)].map(m => m[1]))]
    if (programIds.length === 0) return ''

    // Fetch up to 15 detail pages concurrently (limit to avoid overloading)
    const detailTexts = await Promise.all(
      programIds.slice(0, 15).map(async (pid) => {
        try {
          const res = await fetch(`${origin}/program_details.aspx?ProgramID=${pid}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fraydi/1.0)' },
            signal: AbortSignal.timeout(8000),
          })
          if (!res.ok) return ''
          const html = await res.text()
          return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(500, 4000) // skip nav, get content
        } catch { return '' }
      })
    )

    return detailTexts.filter(Boolean).join('\n\n---\n\n').slice(0, 12000)
  } catch { return '' }
}

export async function scrapeEventsFromUrl(
  url: string,
  interestKeywords: string[] = []
): Promise<ScrapedEvent[]> {
  // Step 1: Fetch the page content — use deep scraper for known platforms
  let pageText = ''
  try {
    // myrec.com gets deep scraping: list + detail pages for date/time/fee
    if (url.includes('myrec.com')) {
      pageText = await scrapeMyrec(url)
    } else {
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
