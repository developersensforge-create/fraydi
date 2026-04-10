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
  days?: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  emoji?: string
}

const MOCK_ROUTINES: Routine[] = [
  { id: 'r1', title: 'Kids lunch box',  assigned: 'Dad',  color: '#3b82f6', time: '7:30am',  done: false, repeat: 'daily', emoji: '🧺' },
  { id: 'r2', title: 'Grocery run',     assigned: 'Mom',  color: '#10b981', time: '10:00am', done: true,  repeat: 'daily', emoji: '🛒' },
  { id: 'r3', title: 'Homework signup', assigned: 'Kids', color: '#8b5cf6', time: '8:00pm',  done: false, repeat: 'daily', emoji: '📚' },
]

const PEOPLE = ['Dad', 'Mom', 'Kids', 'Everyone']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type AddRoutineModalProps = {
  onClose: () => void
  onAdd: (r: Routine) => void
}

function AddRoutineModal({ onClose, onAdd }: AddRoutineModalProps) {
  const [title, setTitle] = useState('')
  const [assigned, setAssigned] = useState(PEOPLE[0])
  const [repeat, setRepeat] = useState<RepeatType>('daily')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri default
  const [time, setTime] = useState('07:30')

  const toggleDay = (d: number) => {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const COLORS: Record<string, string> = {
    Dad: '#3b82f6', Mom: '#10b981', Kids: '#8b5cf6', Everyone: '#f96400',
  }

  const handleSave = () => {
    if (!title.trim()) return
    const [hRaw, mRaw] = time.split(':')
    const h = parseInt(hRaw)
    const m = mRaw || '00'
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    const displayTime = `${h12}:${m}${ampm}`

    onAdd({
      id: `r-${Date.now()}`,
      title: title.trim(),
      assigned,
      color: COLORS[assigned] ?? '#f96400',
      time: displayTime,
      done: false,
      repeat,
      days: repeat === 'weekly' ? days : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Routine</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. School drop-off"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assigned to</label>
            <select
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            >
              {PEOPLE.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Repeat</label>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as RepeatType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {repeat === 'weekly' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                      days.includes(i)
                        ? 'bg-[#f96400] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={DAY_FULL[i]}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
            />
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RoutinesCard() {
  const [routines, setRoutines] = useState<Routine[]>(MOCK_ROUTINES)
  const [showAdd, setShowAdd] = useState(false)

  const todayDow = new Date().getDay()

  // Filter to today's applicable routines
  const todaysRoutines = routines.filter((r) => {
    if (r.repeat === 'daily') return true
    if (r.repeat === 'weekly' && r.days) return r.days.includes(todayDow)
    return false
  })

  const toggleDone = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))
    )
  }

  const addRoutine = (r: Routine) => {
    setRoutines((prev) => [...prev, r])
  }

  const doneCount = todaysRoutines.filter((r) => r.done).length

  return (
    <>
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔄</span>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Today&apos;s Routines</h2>
                <p className="text-xs text-gray-400">{doneCount}/{todaysRoutines.length} done</p>
              </div>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs font-semibold text-[#f96400] hover:bg-orange-50 px-2 py-1 rounded-lg transition-colors"
            >
              + Add
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {todaysRoutines.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No routines for today.</p>
          ) : (
            <ul className="space-y-2">
              {todaysRoutines.map((routine) => (
                <li key={routine.id} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDone(routine.id)}
                    className={`h-5 w-5 flex-shrink-0 rounded flex items-center justify-center border-2 transition-colors ${
                      routine.done
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-[#f96400]'
                    }`}
                    aria-label={routine.done ? 'Mark undone' : 'Mark done'}
                  >
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
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: routine.color }}
                    />
                    <span className="text-xs text-gray-500">{routine.assigned}</span>
                    <span className="text-xs text-gray-400">· {routine.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {showAdd && (
        <AddRoutineModal
          onClose={() => setShowAdd(false)}
          onAdd={addRoutine}
        />
      )}
    </>
  )
}
