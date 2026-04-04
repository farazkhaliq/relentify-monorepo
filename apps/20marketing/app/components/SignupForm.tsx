'use client'

import { useState } from 'react'
import { Button, Input, Label } from '@relentify/ui'
import { ArrowRight, Loader2 } from 'lucide-react'

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.relentify.com'

interface SignupFormProps {
  product: string
  redirectUrl: string
  buttonText?: string
}

export function SignupForm({ product, redirectUrl, buttonText = 'Start Free Trial' }: SignupFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${AUTH_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName,
          email,
          password,
          product,
          tier: 'invoicing', // free tier
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      // Cookie is set by the API response (domain .relentify.com)
      // Redirect to the product
      window.location.href = redirectUrl
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <Label className="text-[var(--theme-text-muted)] text-xs uppercase tracking-wider">Full Name</Label>
        <Input
          type="text"
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="John Smith"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-[var(--theme-text-muted)] text-xs uppercase tracking-wider">Email</Label>
        <Input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-[var(--theme-text-muted)] text-xs uppercase tracking-wider">Password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          className="mt-1"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <ArrowRight size={18} className="mr-2" />}
        {buttonText}
      </Button>

      <p className="text-xs text-center text-[var(--theme-text-muted)]">
        Free 31-day trial. No credit card required.
      </p>
    </form>
  )
}
