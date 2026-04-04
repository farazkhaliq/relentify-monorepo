'use client'

import { useState } from 'react'

function useProduct() {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host.includes('chat.')) return 'chat'
  if (host.includes('connect.')) return 'connect'
  return 'crm'
}

function ChatPortalLogin() {
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
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  if (sent) {
    return (
      <div className="max-w-sm w-full p-8 text-center">
        <h1 className="text-xl font-bold mb-2">Check your email</h1>
        <p className="text-sm text-[var(--theme-text-muted)]">If your email is registered, you will receive a login link shortly.</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm w-full p-8">
      <h1 className="text-xl font-bold mb-1">Support Portal</h1>
      <p className="text-sm text-[var(--theme-text-muted)] mb-6">Enter your email to receive a login link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)]" />
        <input type="text" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Organisation ID" required className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)]" />
        {error && <p className="text-sm text-[var(--theme-destructive)]">{error}</p>}
        <button type="submit" className="w-full py-2.5 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">Send Login Link</button>
      </form>
    </div>
  )
}

function CrmPortalLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Login failed.')
      }
      window.location.href = '/portal/dashboard'
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm w-full p-8">
      <h1 className="text-xl font-bold mb-1">Tenant / Landlord Portal</h1>
      <p className="text-sm text-[var(--theme-text-muted)] mb-6">Log in to manage your property.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)]" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--theme-primary)]" />
        {error && <p className="text-sm text-[var(--theme-destructive)]">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-2.5 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p className="text-center text-sm mt-4 text-[var(--theme-text-muted)]">Need an account? <a href="/portal/signup" className="text-[var(--theme-primary)] underline">Sign up</a></p>
    </div>
  )
}

export default function PortalLoginPage() {
  const product = useProduct()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-background)]">
      {product === 'crm' ? <CrmPortalLogin /> : <ChatPortalLogin />}
    </div>
  )
}
