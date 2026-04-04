import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// Placeholder coordination tasks — replace with Supabase data
const placeholderTasks = [
  {
    id: 1,
    question: 'Who\'s picking up Emma from football?',
    assignedTo: null,
    urgency: 'high',
  },
  {
    id: 2,
    question: 'Did anyone call the plumber?',
    assignedTo: 'Dad',
    urgency: 'medium',
  },
]

const urgencyStyles: Record<string, string> = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-amber-600 bg-amber-50',
  low: 'text-green-600 bg-green-50',
}

/**
 * CoordinationAlert
 * Shows open "who's got this?" questions that need a family member to claim them.
 * TODO: Connect to Supabase tasks table
 * TODO: Wire up AI assignment suggestions via OpenAI
 * TODO: Send notifications via Resend when a task is claimed
 */
export default function CoordinationAlert() {
  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-base">🤝</span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Today's Coordination</h2>
            <p className="text-xs text-gray-400">Who's got this?</p>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <ul className="space-y-3">
          {placeholderTasks.map((task) => (
            <li
              key={task.id}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-800 leading-snug">{task.question}</p>
                <span
                  className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${urgencyStyles[task.urgency]}`}
                >
                  {task.urgency}
                </span>
              </div>

              {task.assignedTo ? (
                <p className="text-xs text-gray-500">
                  ✓ Claimed by <span className="font-medium text-gray-700">{task.assignedTo}</span>
                </p>
              ) : (
                <Button size="sm" variant="outline" className="text-xs mt-1">
                  I've got it
                </Button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">
            🤖 AI suggestions · Connect Supabase to activate
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
