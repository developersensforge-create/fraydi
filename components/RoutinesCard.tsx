'use client'

import { useState } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type RepeatType = 'daily' | 'weekly'

type Routine = {
  id: string
  title: string
  assigned: string
  color: string
  time: string
  done: boolean
  repeat: RepeatType
  days?: number[]
  emoji?: string
}

type AISuggestion = {
  title: string
  assigned: string
  repeat: RepeatType
  days?: number[]
  time: string
  emoji?: string
  reason?: string
}

const MOCK_ROUTINES: Routine[] = []  // Start empty to show "setup" state

const PEOPLE = ['Dad', 'Mom', 'Kids', 'Everyone']
const COLORS: Record<string, string> = {
  Dad: '#3b82f6', Mom: '#10b981', Kids: '#8b5cf6', Everyone: '#f96400',
}
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

// ── Manual Add Modal ──────────────────────────────────────────────────────────
function AddRoutineModal({ onClose, onAdd }: { onClose: () => void; onAdd: (r: Routine) => void }) {
  const [title, setTitle] = useState('')
  const [assigned, setAssigned] = useState(PEOPLE[0])
  const [repeat, setRepeat] = useState<RepeatType>('daily')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [time, setTime] = useState('07:30')

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const handleSave = () => {
    if (!title.trim()) return
    const [hRaw, mRaw] = time.split(':')
    const h = parseInt(hRaw)
    const m = mRaw || '00'
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    onAdd({
      id: `r-${Date.now()}`,
      title: title.trim(),
      assigned,
      color: COLORS[assigned] ?? '#f96400',
      time: `${h12}:${m}${ampm}`,
      done: false,
      repeat,
      days: repeat === 'weekly' ? days : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Add Routine</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. School drop-off"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assigned to</label>
            <select value={assigned} onChange={e => setAssigned(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]">
              {PEOPLE.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Repeat</label>
            <select value={repeat} onChange={e => setRepeat(e.target.value as RepeatType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {repeat === 'weekly' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${days.includes(i) ? 'bg-[#f96400] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]" />
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400]">Save</button>
        </div>
      </div>
    </div>
  )
}

// ── AI Planner Modal ──────────────────────────────────────────────────────────
function AIRoutinePlanner({ onClose, onAddAll }: { onClose: () => void; onAddAll: (routines: Routine[]) => void }) {
  const [phase, setPhase] = useState<'input' | 'loading' | 'review'>('input')
  const [prompt, setPrompt] = useState('')
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [accepted, setAccepted] = useState<Routine[]>([])
  const [editTitle, setEditTitle] = useState('')
  const [error, setError] = useState('')

  const appendTag = (tag: string) => {
    setPrompt(prev => prev ? `${prev}, ${tag}` : tag)
  }

  const generate = async () => {
    if (!prompt.trim()) return
    setPhase('loading')
    setError('')
    try {
      const res = await fetch('/api/routines/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok || !data.suggestions?.length) throw new Error(data.error || 'No suggestions')
      setSuggestions(data.suggestions)
      setReviewIndex(0)
      setEditTitle(data.suggestions[0]?.title ?? '')
      setPhase('review')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setPhase('input')
    }
  }

  const current = suggestions[reviewIndex]

  const makeRoutine = (s: AISuggestion, titleOverride?: string): Routine => ({
    id: `ai-${Date.now()}-${reviewIndex}`,
    title: titleOverride ?? s.title,
    assigned: PEOPLE.includes(s.assigned) ? s.assigned : 'Everyone',
    color: COLORS[PEOPLE.includes(s.assigned) ? s.assigned : 'Everyone'] ?? '#f96400',
    time: s.time ?? '8:00am',
    done: false,
    repeat: s.repeat ?? 'daily',
    days: s.days,
    emoji: s.emoji,
  })

  const advance = (acc?: Routine) => {
    if (acc) setAccepted(prev => [...prev, acc])
    if (reviewIndex < suggestions.length - 1) {
      const next = reviewIndex + 1
      setReviewIndex(next)
      setEditTitle(suggestions[next]?.title ?? '')
    } else {
      // Done reviewing — commit accepted + current if accepted
      onAddAll(acc ? [...accepted, acc] : accepted)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">✨ AI Routine Planner</h3>
            {phase === 'review' && (
              <p className="text-xs text-gray-400 mt-0.5">Reviewing {reviewIndex + 1} of {suggestions.length}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Review progress bar */}
        {phase === 'review' && (
          <div className="h-1 bg-gray-100">
            <div className="h-1 bg-[#f96400] transition-all"
              style={{ width: `${((reviewIndex + 1) / suggestions.length) * 100}%` }} />
          </div>
        )}

        <div className="px-5 py-4">

          {/* ── Input phase ── */}
          {phase === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Describe your routine challenge or wish</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. My kids never clean their room and mornings are chaotic..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400] resize-none"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Or tap a common scenario:</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TAGS.map(tag => (
                    <button key={tag} onClick={() => appendTag(tag)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:border-[#f96400] hover:text-[#f96400] transition-colors">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button onClick={generate} disabled={!prompt.trim()}
                className="w-full py-2.5 rounded-xl bg-[#f96400] text-white text-sm font-semibold hover:bg-[#d95400] disabled:opacity-40 transition-colors">
                Generate routines →
              </button>
            </div>
          )}

          {/* ── Loading phase ── */}
          {phase === 'loading' && (
            <div className="py-8 text-center space-y-3">
              <div className="text-3xl animate-bounce">✨</div>
              <p className="text-sm text-gray-500">Planning your routines…</p>
            </div>
          )}

          {/* ── Review phase ── */}
          {phase === 'review' && current && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{current.emoji ?? '📋'}</span>
                  <div>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#f96400] focus:outline-none w-full"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">
                      {current.assigned} · {current.time} · {current.repeat === 'daily' ? 'Daily' : (current.days ?? []).map(d => DAY_FULL[d]).join(', ')}
                    </p>
                  </div>
                </div>
                {current.reason && (
                  <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2">{current.reason}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => advance()}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50">
                  Skip
                </button>
                <button onClick={() => advance(makeRoutine(current, editTitle))}
                  className="flex-1 py-2 rounded-xl bg-[#f96400] text-white text-sm font-semibold hover:bg-[#d95400]">
                  {reviewIndex < suggestions.length - 1 ? 'Accept →' : 'Accept ✓'}
                </button>
              </div>
              <p className="text-center text-xs text-gray-400">
                Tap title to edit before accepting
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Main Card ─────────────────────────────────────────────────────────────────
export default function RoutinesCard() {
  const [routines, setRoutines] = useState<Routine[]>(MOCK_ROUTINES)
  const [showAdd, setShowAdd] = useState(false)
  const [showAI, setShowAI] = useState(false)

  const todayDow = new Date().getDay()

  const todaysRoutines = routines.filter(r => {
    if (r.repeat === 'daily') return true
    if (r.repeat === 'weekly' && r.days) return r.days.includes(todayDow)
    return false
  })

  const weeklyTotal = routines.reduce((sum, r) => {
    if (r.repeat === 'daily') return sum + 7
    if (r.repeat === 'weekly' && r.days) return sum + r.days.length
    return sum
  }, 0)

  const doneCount = todaysRoutines.filter(r => r.done).length
  const hasAnyRoutines = routines.length > 0

  const toggleDone = (id: string) =>
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, done: !r.done } : r))

  const addRoutine = (r: Routine) => setRoutines(prev => [...prev, r])
  const addAll = (rs: Routine[]) => setRoutines(prev => [...prev, ...rs])

  // Next upcoming routine (not done, with time)
  const nextUp = todaysRoutines.find(r => !r.done)

  return (
    <>
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔄</span>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Routines</h2>
                {hasAnyRoutines && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{doneCount}/{todaysRoutines.length} today</p>
                    <span className="text-gray-300">·</span>
                    <p className="text-xs text-gray-400">{weeklyTotal} weekly total</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setShowAI(true)}
                className="text-xs font-semibold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                ✨ AI
              </button>
              <button onClick={() => setShowAdd(true)}
                className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors">
                + Add
              </button>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          {/* Empty state: no routines set up at all */}
          {!hasAnyRoutines && (
            <div className="text-center py-6 space-y-3">
              <p className="text-2xl">📋</p>
              <p className="text-sm font-medium text-gray-700">Set up your routines</p>
              <p className="text-xs text-gray-400">Build consistent habits for the whole family</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowAI(true)}
                  className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-xl hover:bg-[#d95400] transition-colors">
                  ✨ Plan with AI
                </button>
                <button onClick={() => setShowAdd(true)}
                  className="px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                  Add manually
                </button>
              </div>
            </div>
          )}

          {/* Has routines but nothing today */}
          {hasAnyRoutines && todaysRoutines.length === 0 && (
            <div className="text-center py-4 space-y-1">
              <p className="text-sm text-gray-400">Nothing today</p>
              {nextUp === undefined && routines.find(r => r.repeat === 'weekly') && (
                <p className="text-xs text-gray-400">
                  Next up: {(() => {
                    const upcoming = routines
                      .filter(r => r.repeat === 'weekly' && r.days)
                      .flatMap(r => (r.days ?? []).map(d => ({ ...r, day: d })))
                      .filter(r => r.day > todayDow)
                      .sort((a, b) => a.day - b.day)[0]
                    return upcoming ? `${upcoming.title} (${DAY_FULL[upcoming.day]})` : 'later this week'
                  })()}
                </p>
              )}
            </div>
          )}

          {/* Today's routines list */}
          {todaysRoutines.length > 0 && (
            <ul className="space-y-2">
              {todaysRoutines.map(routine => (
                <li key={routine.id} className="flex items-center gap-3">
                  <button onClick={() => toggleDone(routine.id)}
                    className={`h-5 w-5 flex-shrink-0 rounded flex items-center justify-center border-2 transition-colors ${routine.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-[#f96400]'}`}
                    aria-label={routine.done ? 'Mark undone' : 'Mark done'}>
                    {routine.done && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="text-base flex-shrink-0">{routine.emoji ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${routine.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {routine.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: routine.color }} />
                    <span className="text-xs text-gray-500">{routine.assigned}</span>
                    <span className="text-xs text-gray-400">· {routine.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {showAdd && <AddRoutineModal onClose={() => setShowAdd(false)} onAdd={addRoutine} />}
      {showAI && <AIRoutinePlanner onClose={() => setShowAI(false)} onAddAll={addAll} />}
    </>
  )
}
