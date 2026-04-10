'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type InviteInfo = {
  member_name: string
  role: string
  family_name: string
  invite_status: string
}

type PageState = 'loading' | 'ready' | 'success' | 'error' | 'already_used'

export default function InvitePage() {
  const params = useParams()
  const token = params?.token as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successAccess, setSuccessAccess] = useState<string>('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!token) return

    fetch(`/api/family/invite/${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 410) {
            setPageState('already_used')
            setErrorMsg(data.error || 'This invite has already been used.')
          } else {
            setPageState('error')
            setErrorMsg(data.error || 'Invite not found.')
          }
          return
        }
        setInvite(data.invite)
        setPageState('ready')
      })
      .catch(() => {
        setPageState('error')
        setErrorMsg('Failed to load invite. Please try again.')
      })
  }, [token])

  async function handleAccept(calendarAccess: 'full' | 'busy_only') {
    if (acting) return
    setActing(true)
    try {
      const res = await fetch(`/api/family/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_access: calendarAccess }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to accept invite.')
        setActing(false)
        return
      }
      setSuccessAccess(calendarAccess === 'full' ? 'full calendar' : 'availability only')
      setPageState('success')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setActing(false)
    }
  }

  async function handleDecline() {
    if (acting) return
    setActing(true)
    try {
      const res = await fetch(`/api/family/invite/${token}/decline`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error || 'Failed to decline invite.')
        setActing(false)
        return
      }
      setPageState('success')
      setSuccessAccess('')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setActing(false)
    }
  }

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      spouse: 'Spouse',
      'co-parent': 'Co-Parent',
      grandparent: 'Grandparent',
      caregiver: 'Caregiver',
      other: 'Family Coordinator',
    }
    return labels[role] || role
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        background: 'white',
        borderRadius: 16,
        padding: 40,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#f96400', fontSize: 28, margin: 0 }}>Fraydi</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
            Family coordination, simplified
          </p>
        </div>

        {/* Loading */}
        {pageState === 'loading' && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px 0' }}>
            <p>Loading your invitation…</p>
          </div>
        )}

        {/* Error */}
        {(pageState === 'error' || pageState === 'already_used') && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {pageState === 'already_used' ? '✅' : '❌'}
            </div>
            <h2 style={{ color: '#111827', fontSize: 20, margin: '0 0 12px' }}>
              {pageState === 'already_used' ? 'Already responded' : 'Invite not found'}
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15 }}>{errorMsg}</p>
          </div>
        )}

        {/* Ready state — show invite details */}
        {pageState === 'ready' && invite && (
          <>
            <h2 style={{ color: '#111827', fontSize: 20, margin: '0 0 8px' }}>
              You&apos;re invited! 🎉
            </h2>
            <p style={{ color: '#374151', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
              You&apos;ve been invited to coordinate for the{' '}
              <strong>{invite.family_name}</strong> family on Fraydi as{' '}
              <strong>{roleLabel(invite.role)}</strong>.
            </p>

            <p style={{ color: '#374151', fontSize: 15, marginBottom: 16 }}>
              How much calendar access would you like to share?
            </p>

            {errorMsg && (
              <p style={{
                color: '#dc2626',
                background: '#fef2f2',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 14,
                marginBottom: 16,
              }}>
                {errorMsg}
              </p>
            )}

            {/* Full calendar CTA */}
            <button
              onClick={() => handleAccept('full')}
              disabled={acting}
              style={{
                display: 'block',
                width: '100%',
                background: acting ? '#fdb990' : '#f96400',
                color: 'white',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                padding: '14px 24px',
                borderRadius: 10,
                cursor: acting ? 'not-allowed' : 'pointer',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              📅 Share full calendar
            </button>

            {/* Busy-only CTA */}
            <button
              onClick={() => handleAccept('busy_only')}
              disabled={acting}
              style={{
                display: 'block',
                width: '100%',
                background: '#fef3ec',
                color: '#f96400',
                border: '2px solid #f96400',
                fontSize: 15,
                fontWeight: 600,
                padding: '14px 24px',
                borderRadius: 10,
                cursor: acting ? 'not-allowed' : 'pointer',
                marginBottom: 24,
                textAlign: 'center',
                opacity: acting ? 0.7 : 1,
              }}
            >
              🕐 Share availability only (busy/free)
            </button>

            {/* Decline */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleDecline}
                disabled={acting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: 14,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Decline invitation
              </button>
            </div>
          </>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {successAccess ? '🎉' : '👋'}
            </div>
            <h2 style={{ color: '#111827', fontSize: 20, margin: '0 0 12px' }}>
              {successAccess ? 'You\'re all set!' : 'Invitation declined'}
            </h2>
            {successAccess ? (
              <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.6 }}>
                You&apos;re now coordinating with your family. You&apos;ve chosen to share your{' '}
                <strong>{successAccess}</strong>.
              </p>
            ) : (
              <p style={{ color: '#6b7280', fontSize: 15 }}>
                You&apos;ve declined this invitation. You can always reach out to your family to get a new one.
              </p>
            )}
            <a
              href="https://fraydi.vercel.app"
              style={{
                display: 'inline-block',
                marginTop: 24,
                color: '#f96400',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Go to Fraydi →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
