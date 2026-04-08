"use client"

import { useState, useEffect, useCallback } from 'react'

type Member = {
  id: string
  name: string
  color: string
}

type Task = {
  id: string
  title: string
  assigned_to?: string
  assignedTo?: string
  assigned_name?: string
  assignedName?: string
  assigned_color?: string
  assignedColor?: string
  due_date?: string
  dueDate?: string
  completed: boolean
}

export default function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [adding, setAdding] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, familyRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/family'),
      ])
      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(Array.isArray(data) ? data : data.tasks || [])
      }
      if (familyRes.ok) {
        const familyData = await familyRes.json()
        setMembers(familyData.members || [])
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const toggleTask = async (task: Task) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      })
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
    }
  }

  const addTask = async () => {
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          assigned_to: newAssignee || undefined,
          due_date: newDueDate || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newTask: Task = data.task || data
        setTasks(prev => [newTask, ...prev])
        setNewTitle('')
        setNewAssignee('')
        setNewDueDate('')
        setShowAddForm(false)
      }
    } catch {}
    finally { setAdding(false) }
  }

  const activeTasks = tasks.filter(t => !t.completed)
  const visibleTasks = expanded ? activeTasks : activeTasks.slice(0, 5)
  const hiddenCount = activeTasks.length - 5

  const getAssigneeName = (task: Task) =>
    task.assigned_name || task.assignedName || members.find(m => m.id === (task.assigned_to || task.assignedTo))?.name

  const getAssigneeColor = (task: Task) =>
    task.assigned_color || task.assignedColor || members.find(m => m.id === (task.assigned_to || task.assignedTo))?.color || '#9ca3af'

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return { label: 'Overdue', color: 'text-red-500' }
    if (diff === 0) return { label: 'Today', color: 'text-[#f96400]' }
    if (diff === 1) return { label: 'Tomorrow', color: 'text-orange-400' }
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-gray-400' }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <h2 className="text-sm font-semibold text-gray-900">Tasks</h2>
          {activeTasks.length > 0 && (
            <span className="bg-[#f96400] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {activeTasks.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-semibold text-[#f96400] hover:underline"
        >
          + Add task
        </button>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <input
            autoFocus
            type="text"
            placeholder="Task title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white mb-2"
          />
          <div className="flex gap-2 mb-2">
            <select
              value={newAssignee}
              onChange={e => setNewAssignee(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white"
            >
              <option value="">Assign to...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#f96400] bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addTask}
              disabled={adding || !newTitle.trim()}
              className="flex-1 bg-[#f96400] text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-[#d95400] transition disabled:opacity-60"
            >
              {adding ? 'Adding...' : 'Add task'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewTitle(''); setNewAssignee(''); setNewDueDate('') }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-xs text-gray-400">No tasks yet — add something to do</p>
          </div>
        ) : (
          <div className="space-y-1">
            {visibleTasks.map(task => {
              const assigneeName = getAssigneeName(task)
              const assigneeColor = getAssigneeColor(task)
              const dueDateInfo = formatDueDate(task.due_date || task.dueDate)
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 group transition-colors"
                >
                  <button
                    onClick={() => toggleTask(task)}
                    className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                      task.completed
                        ? 'bg-[#f96400] border-[#f96400]'
                        : 'border-gray-300 hover:border-[#f96400]'
                    }`}
                  >
                    {task.completed && <span className="text-white text-xs leading-none">✓</span>}
                  </button>
                  <span className={`flex-1 text-xs min-w-0 truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {assigneeName && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assigneeColor }} />
                        <span className="text-xs text-gray-400 hidden sm:block">{assigneeName}</span>
                      </div>
                    )}
                    {dueDateInfo && (
                      <span className={`text-xs ${dueDateInfo.color}`}>{dueDateInfo.label}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {!expanded && hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-xs text-[#f96400] hover:underline py-2 text-center"
              >
                + {hiddenCount} more task{hiddenCount !== 1 ? 's' : ''}
              </button>
            )}
            {expanded && activeTasks.length > 5 && (
              <button
                onClick={() => setExpanded(false)}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 text-center"
              >
                Show less ↑
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
