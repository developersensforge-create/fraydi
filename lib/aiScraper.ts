import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export type ScrapedEvent = {
  title: string
  description?: string
  event_date?: string  // YYYY-MM-DD
  event_time?: string  // e.g. "2:00 PM"
  location?: string
  url?: string
  relevance_score?: number
}

export async function scrapeEventsFromUrl(
  url: string,
  interestKeywords: string[] = []
): Promise<ScrapedEvent[]> {
  // Step 1: Fetch the page content
  let pageText = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fraydi/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    // Strip HTML tags, collapse whitespace, limit to 8000 chars
    pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
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
            ` Return JSON array only. Each event: { title, description (brief), event_date (YYYY-MM-DD or null), event_time (e.g. "2:00 PM" or null), location (or null), url (if found, or null), relevance_score (1-5) }. If no events found, return []. Return only valid JSON, no markdown.`,
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
