'use client'

import { useState } from 'react'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [entityId, setEntityId] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, entity_id: entityId }),
      })
      if (!res.ok) throw new Error('Login failed')
      setSent(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--theme-background)]">
        <div className="max-w-sm w-full p-8 text-center">
          <h1 className="text-xl font-bold mb-2">Check your email</h1>
          <p className="text-sm text-[var(--theme-text-muted)]">If your email is registered, you will receive a login link shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-background)]">
      <div className="max-w-sm w-full p-8">
        <h1 className="text-xl font-bold mb-1">Support Portal</h1>
        <p className="text-sm text-[var(--theme-text-muted)] mb-6">Enter your email to receive a login link.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)]"
          />
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Organisation ID"
            required
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)]"
          />
          {error && <p className="text-sm text-[var(--theme-destructive)]">{error}</p>}
          <button type="submit" className="w-full py-2.5 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
            Send Login Link
          </button>
        </form>
      </div>
    </div>
  )
}
