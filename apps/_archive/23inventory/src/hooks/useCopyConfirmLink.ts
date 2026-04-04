'use client'
import { useState } from 'react'

export function useCopyConfirmLink(inventoryId: string, initialSentAt: string | null) {
  const [loading, setLoading] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt)
  const [error, setError] = useState<string | null>(null)

  const sendEmail = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventories/${inventoryId}/send-email`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to deliver transmission')
      const now = new Date().toISOString()
      setSentAt(now)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transmission failure')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { loading, sentAt, error, sendEmail, setError }
}
