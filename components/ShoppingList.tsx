'use client'

import { useState } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

// Placeholder items — replace with Supabase real-time subscription
const initialItems = [
  { id: 1, name: 'Milk (2L)', checked: false, addedBy: 'Mum' },
  { id: 2, name: 'Bread', checked: true, addedBy: 'Dad' },
  { id: 3, name: 'Apples ×6', checked: false, addedBy: 'Emma' },
  { id: 4, name: 'Pasta sauce', checked: false, addedBy: 'Mum' },
]

type Item = { id: number; name: string; checked: boolean; addedBy: string }

/**
 * ShoppingList
 * Shared real-time shopping list for the family.
 * TODO: Replace local state with Supabase real-time subscription
 * TODO: Add voice/text input for adding items
 * TODO: Auto-categorise by store using OpenAI
 */
export default function ShoppingList() {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [newItem, setNewItem] = useState('')

  const toggle = (id: number) =>
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    )

  const addItem = () => {
    if (!newItem.trim()) return
    setItems((prev) => [
      ...prev,
      { id: Date.now(), name: newItem.trim(), checked: false, addedBy: 'You' },
    ])
    setNewItem('')
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-base">🛒</span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Shopping List</h2>
            <p className="text-xs text-gray-400">
              {unchecked.length} item{unchecked.length !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {/* Add item */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add an item…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f96400] focus:border-transparent"
          />
          <button
            onClick={addItem}
            className="rounded-lg bg-[#f96400] px-3 py-2 text-white text-sm font-semibold hover:bg-[#d95400] transition-colors"
          >
            +
          </button>
        </div>

        {/* Unchecked items */}
        <ul className="space-y-2">
          {unchecked.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <button
                onClick={() => toggle(item.id)}
                className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-gray-300 hover:border-[#f96400] transition-colors"
              />
              <span className="flex-1 text-sm text-gray-800">{item.name}</span>
              <span className="text-xs text-gray-400">{item.addedBy}</span>
            </li>
          ))}
        </ul>

        {/* Checked items */}
        {checked.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Done</p>
            <ul className="space-y-2">
              {checked.map((item) => (
                <li key={item.id} className="flex items-center gap-3 opacity-50">
                  <button
                    onClick={() => toggle(item.id)}
                    className="h-4 w-4 flex-shrink-0 rounded-full bg-green-400 border-2 border-green-400"
                  />
                  <span className="flex-1 text-sm text-gray-500 line-through">{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">
            ⚡ Real-time sync · Connect Supabase to activate
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
