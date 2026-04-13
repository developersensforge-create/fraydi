import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'

// Popular routine tags for quick input — based on family coordination research
const POPULAR_TAGS = [
  "Kids clean their room",
  "Weekend family cleaning",
  "School lunch prep",
  "Homework time",
  "Morning school drop-off",
  "Evening reading with kids",
  "Grocery run",
  "Trash/recycling day",
  "Family dinner together",
  "Sports practice pickup",
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  const systemPrompt = `You are a family routine planning assistant for Fraydi, a family coordination app.
Given a user's description of their routine struggles or wishes, generate 2-5 concrete routine cards.
Each card must be practical, specific, and fit a family with kids.

Respond ONLY with a JSON array of routine objects. No explanation. Max 5 items.
Each object has:
- title: string (short, actionable, max 8 words)
- assigned: one of "Dad" | "Mom" | "Kids" | "Everyone"
- repeat: "daily" | "weekly"  
- days: number[] only if weekly (0=Sun,1=Mon,...,6=Sat), omit if daily
- time: string in format "7:30am" or "6:00pm"
- emoji: single relevant emoji
- reason: one sentence why this helps (shown to user during review)`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? '[]'

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return NextResponse.json({ suggestions: suggestions.slice(0, 5) })
  } catch (e) {
    console.error('[ai-suggest]', e)
    return NextResponse.json({ error: 'AI suggestion failed' }, { status: 500 })
  }
}
