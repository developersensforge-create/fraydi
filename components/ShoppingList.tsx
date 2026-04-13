'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

type Item = {
  id: string
  name: string
  category?: string
  quantity?: string
  checked: boolean
  added_by?: string
  checked_by_name?: string
}

export default function ShoppingList({ kidMode = false }: { kidMode?: boolean }) {
  const [items, setItems] = useState<Item[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  useEffect(() => {
    fetch('/api/shopping')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const addItem = async () => {
    if (!newItem.trim()) return
    const name = newItem.trim()
    setNewItem('')
    // Optimistic
    const tempId = 'temp-' + Date.now()
    setItems(prev => [...prev, { id: tempId, name, checked: false }])
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setItems(prev => prev.map(i => i.id === tempId ? { ...i, id: data.item?.id ?? tempId } : i))
  }

  const toggle = async (id: string, checked: boolean) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i))
    await fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, checked }),
    })
  }

  const clearChecked = async () => {
    setItems(prev => prev.filter(i => !i.checked))
    await fetch('/api/shopping?mode=checked', { method: 'DELETE' })
    setShowConfirmClear(false)
  }

  const clearAll = async () => {
    setItems([])
    await fetch('/api/shopping?mode=all', { method: 'DELETE' })
    setShowConfirmClear(false)
  }

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)

  // Group unchecked by category
  const byCategory: Record<string, Item[]> = {}
  for (const item of unchecked) {
    const cat = item.category ?? 'General'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🛒</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Shopping List</h2>
              <p className="text-xs text-gray-400">{unchecked.length} item{unchecked.length !== 1 ? 's' : ''} to get</p>
            </div>
          </div>
          {items.length > 0 && (
            <button onClick={() => setShowConfirmClear(true)}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors">
              🔄 New trip
            </button>
          )}
        </div>
      </CardHeader>

      <CardBody>
        {/* Add item */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add an item…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400]"
          />
          <button onClick={addItem}
            className="rounded-lg bg-[#f96400] px-3 py-2 text-white text-sm font-semibold hover:bg-[#d95400] transition-colors">
            +
          </button>
        </div>

        {loading && <p className="text-xs text-gray-300 text-center py-2">Loading…</p>}

        {/* Items by category */}
        {Object.entries(byCategory).map(([cat, catItems]) => (
          <div key={cat} className="mb-3">
            {Object.keys(byCategory).length > 1 && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{cat}</p>
            )}
            <ul className="space-y-2">
              {catItems.map(item => (
                <li key={item.id} className="flex items-center gap-3">
                  <button onClick={() => toggle(item.id, true)}
                    className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-gray-300 hover:border-[#f96400] transition-colors" />
                  <span className="flex-1 text-sm text-gray-800">{item.name}{item.quantity ? ` (${item.quantity})` : ''}</span>
                  {item.added_by && <span className="text-xs text-gray-400 truncate max-w-[60px]">{item.added_by}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!loading && unchecked.length === 0 && checked.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No items yet. Add something above.</p>
        )}

        {/* Checked items */}
        {checked.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">In cart ✓</p>
            <ul className="space-y-2">
              {checked.map(item => (
                <li key={item.id} className="flex items-center gap-3 opacity-50">
                  <button onClick={() => toggle(item.id, false)}
                    className="h-4 w-4 flex-shrink-0 rounded-full bg-green-400 border-2 border-green-400" />
                  <span className="flex-1 text-sm text-gray-500 line-through">{item.name}</span>
                  {item.checked_by_name && <span className="text-xs text-gray-400">{item.checked_by_name}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clear confirm modal */}
        {showConfirmClear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Start new shopping trip?</h3>
              <p className="text-sm text-gray-500">Clear just the checked items, or clear the entire list?</p>
              <div className="flex flex-col gap-2">
                <button onClick={clearChecked}
                  className="w-full py-2 bg-[#f96400] text-white text-sm font-semibold rounded-xl hover:bg-[#d95400]">
                  Clear checked only ({checked.length} items)
                </button>
                <button onClick={clearAll}
                  className="w-full py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
                  Clear entire list ({items.length} items)
                </button>
                <button onClick={() => setShowConfirmClear(false)}
                  className="w-full py-2 text-gray-400 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
