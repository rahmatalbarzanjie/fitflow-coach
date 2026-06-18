'use client'

import { useEffect } from 'react'

// Silently ensures all active classes have upcoming sessions.
// Fires once on dashboard mount - no UI, no loading state shown to user.
export function AutoFillSessions() {
  useEffect(() => {
    fetch('/api/sessions/auto-fill', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
