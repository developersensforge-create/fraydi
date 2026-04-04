"use client"

import { useState } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// TODO: wire to Supabase — query coordination_assignments where status = 'pending'
type Alert = {
  id: string
  message: string
  memberName: string
  eventTime: string
  claimed: boolean
  claimedBy?: string
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    message: "Lily has soccer at 3pm Saturday — who's taking her?",
    memberName: 'Lily',
    eventTime: 'Sat 3:00 PM',
    claimed: false,
  },
  {
    id: '2',
    message: "Emma has a dentist at 10am Monday — who's available?",
    memberName: 'Emma',
    eventTime: 'Mon 10:00 AM',
    claimed: false,
  },
]

export default function CoordinationAlert() {
  // TODO: wire to Supabase — replace with real-time subscription
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts)

  const claimAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, claimed: true, claimedBy: 'You' } : a))
    )
  }

  const pending = alerts.filter((a) => !a.claimed)
  const claimed = alerts.filter((a) => a.claimed)

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🤝</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Coordination Alerts</h2>
              <p className="text-xs text-gray-400">Who&apos;s got this?</p>
            </div>
          </div>
          {pending.length > 0 && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {pending.length === 0 && claimed.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No pending coordination needed 🎉</p>
        )}

        {pending.length > 0 && (
          <ul className="space-y-3">
            {pending.map((alert) => (
              <li
                key={alert.id}
                className="rounded-xl border border-orange-100 bg-orange-50 p-3"
              >
                <p className="text-sm text-gray-800 leading-snug mb-2">{alert.message}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{alert.eventTime}</span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => claimAlert(alert.id)}
                    className="text-xs"
                  >
                    I&apos;ll do it
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {claimed.length > 0 && (
          <div className={pending.length > 0 ? 'mt-4' : ''}>
            {pending.length > 0 && (
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Claimed</p>
            )}
            <ul className="space-y-2">
              {claimed.map((alert) => (
                <li key={alert.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 opacity-60">
                  <p className="text-xs text-gray-700 leading-snug">{alert.message}</p>
                  <p className="text-xs text-green-600 mt-1 font-medium">✓ Claimed by {alert.claimedBy}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">
            {/* TODO: wire to Supabase — coordination_assignments table */}
            🤖 AI suggestions · Connect Supabase to activate
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
