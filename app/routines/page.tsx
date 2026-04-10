'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type RepeatType = 'daily' | 'weekly'

type Routine = {
  id: string
  title: string
  assigned: string
  color: string
  time: string
  active: boolean
  repeat: RepeatType
  days?: number[]
  emoji?: string
}

const MOCK_ROUTINES: Routine[] = [
  { id: 'r1', title: 'Kids lunch box',  assigned: 'Dad',  color: '#3b82f6', time: '7:30am',  active: true,  repeat: 'daily',  emoji: '🧺' },
  { id: 'r2', title: 'Grocery run',     assigned: 'Mom',  color: '#10b981', time: '10:00am', active: true,  repeat: 'weekly', days: [1, 3, 6], emoji: '🛒' },
  { id: 'r3', title: 'Homework signup', assigned: 'Kids', color: '#8b5cf6', time: '8:00pm',  active: true,  repeat: 'daily',  emoji: '📚' },
  { id: 'r4', title: 'Evening walk',    assigned: 'Everyone', color: '#f96400', time: '6:00pm', active: false, repeat: 'daily', emoji: '🚶' },
]

const PEOPLE = ['Dad', 'Mom', 'Kids', 'Everyone']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLORS: Record<string, string> = {
  Dad: '#3b82f6', Mom: '#10b981', Kids: '#8b5cf6', Everyone: '#f96400',
}

type EditModalProps = {
  routine: Routine
  onClose: () => void
  onSave: (r: Routine) => void
}

function EditModal({ routine, onClose, onSave }: EditModalProps) {
  const [title, setTitle] = useState(routine.title)
  const [assigned, setAssigned] = useState(routine.assigned)
  const [repeat, setRepeat] = useState<RepeatType>(routine.repeat)
  const [days, setDays] = useState<number[]>(routine.days ?? [1, 2, 3, 4, 5])
  const [time, setTime] = useState(() => {
    // Parse displayTime back to HH:MM
    const match = routine.time.match(/(\d+):(\d+)(am|pm)/)
    if (!match) return '07:00'
    let h = parseInt(match[1])
    const m = match[2]
    const ampm = match[3]
    if (ampm === 'pm' && h !== 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${m}`
  })

  const toggleDay = (d: number) => {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const handleSave = () => {
    if (!title.trim()) return
    const [hRaw, mRaw] = time.split(':')
    const h = parseInt(hRaw)
    const m = mRaw || '00'
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    const displayTime = `${h12}:${m}${ampm}`
    onSave({
      ...routine,
      title: title.trim(),
      assigned,
      color: COLORS[assigned] ?? '#f96400',
      time: displayTime,
      repeat,
      days: repeat === 'weekly' ? days : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Edit Routine</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
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

function AddRoutineModal({ onClose, onAdd }: { onClose: () => void; onAdd: (r: Routine) => void }) {
  const [title, setTitle] = useState('')
  const [assigned, setAssigned] = useState(PEOPLE[0])
  const [repeat, setRepeat] = useState<RepeatType>('daily')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [time, setTime] = useState('07:30')

  const toggleDay = (d: number) => {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
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
      active: true,
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-lg hover:bg-[#d95400] transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>(MOCK_ROUTINES)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const toggleActive = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    )
  }

  const deleteRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id))
  }

  const saveRoutine = (updated: Routine) => {
    setRoutines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setEditingRoutine(null)
  }

  const addRoutine = (r: Routine) => {
    setRoutines((prev) => [...prev, r])
  }

  const daily = routines.filter((r) => r.repeat === 'daily')
  const weekly = routines.filter((r) => r.repeat === 'weekly')

  const RoutineRow = ({ routine }: { routine: Routine }) => (
    <div className={`flex items-center gap-3 p-4 border-b border-gray-100 last:border-0 ${!routine.active ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-lg">{routine.emoji ?? '📋'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{routine.title}</p>
          {!routine.active && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">Paused</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: routine.color }} />
          <span className="text-xs text-gray-500">{routine.assigned}</span>
          <span className="text-xs text-gray-400">· {routine.time}</span>
          {routine.repeat === 'weekly' && routine.days && (
            <span className="text-xs text-gray-400">
              · {routine.days.map((d) => DAY_FULL[d]).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setEditingRoutine(routine)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
        >
          Edit
        </button>
        <button
          onClick={() => toggleActive(routine.id)}
          className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
            routine.active
              ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {routine.active ? 'Active' : 'Paused'}
        </button>
        <button
          onClick={() => deleteRoutine(routine.id)}
          className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔄 Family Routines</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage recurring tasks for your household.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-semibold bg-[#f96400] text-white rounded-xl hover:bg-[#d95400] transition-colors shadow-sm"
          >
            + Add Routine
          </button>
        </div>

        <div className="space-y-4">
          {/* Daily routines */}
          <Card variant="bordered">
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Daily ({daily.length})
              </h2>
            </CardHeader>
            <CardBody className="!pt-0 !px-0">
              {daily.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No daily routines yet.</p>
              ) : (
                daily.map((r) => <RoutineRow key={r.id} routine={r} />)
              )}
            </CardBody>
          </Card>

          {/* Weekly routines */}
          <Card variant="bordered">
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Weekly ({weekly.length})
              </h2>
            </CardHeader>
            <CardBody className="!pt-0 !px-0">
              {weekly.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No weekly routines yet.</p>
              ) : (
                weekly.map((r) => <RoutineRow key={r.id} routine={r} />)
              )}
            </CardBody>
          </Card>
        </div>
      </main>

      {showAdd && (
        <AddRoutineModal onClose={() => setShowAdd(false)} onAdd={addRoutine} />
      )}
      {editingRoutine && (
        <EditModal
          routine={editingRoutine}
          onClose={() => setEditingRoutine(null)}
          onSave={saveRoutine}
        />
      )}
    </div>
  )
}
