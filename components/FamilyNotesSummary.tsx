'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type Note = {
  id: string
  content: string
  author_name: string
  note_type: string
  created_at: string
  is_done: boolean
}

export default function FamilyNotesSummary() {
  const [notes, setNotes] = useState<Note[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(d => {
      if (d.family_id) {
        setFamilyId(d.family_id)
        fetch(`/api/notes?family_id=${d.family_id}`)
          .then(r => r.json())
          .then(nd => { setNotes(nd.notes ?? []); setLoading(false) })
      } else { setLoading(false) }
    }).catch(() => setLoading(false))
  }, [])

  const markDone = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_done: true }),
    })
  }

  if (!loading && notes.length === 0) return null

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Family Notes</h2>
            {!loading && <p className="text-xs text-gray-400">{notes.length} message{notes.length !== 1 ? 's' : ''} from kids</p>}
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {loading && <p className="text-xs text-gray-300 text-center py-2">Loading…</p>}
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id} className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-bold text-[#f96400]">{n.author_name}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(n.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-snug">{n.content}</p>
              </div>
              <button onClick={() => markDone(n.id)}
                className="flex-shrink-0 text-gray-400 hover:text-green-500 text-lg leading-none mt-0.5"
                title="Mark as read">
                ✓
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
