'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Card, Logo, Label } from '@relentify/ui'
import { AuthShell } from '@/src/components/layout/AuthShell'

function getSafeRedirect(redirect: string | null): string {
  if (!redirect) return '/portal'
  try {
    const url = new URL(redirect)
    if (url.protocol === 'https:' && url.hostname.endsWith('.relentify.com')) {
      return redirect
    }
  } catch {
    // Not a valid absolute URL — fall through to default
  }
  return '/portal'
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      router.push(getSafeRedirect(redirectParam))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-full mb-6 text-[var(--theme-text-85)] font-bold">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@business.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0">Password</Label>
            <Link
              href="/forgot-password"
              className="text-[var(--theme-text-10)] font-bold text-[var(--theme-text-dim)] hover:text-[var(--theme-accent)] no-underline uppercase tracking-widest"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Sign In
        </Button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="text-center mb-10">
        <Logo className="mb-8" />
        <p className="text-[var(--theme-text-muted)] font-medium text-lg">Sign in to your account</p>
      </div>

      <Card>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>

      <p className="text-center text-[var(--theme-text-85)] text-[var(--theme-text-muted)] mt-8 font-medium">
        No account? <Link href="/register" className="text-[var(--theme-accent)] hover:brightness-110 font-bold no-underline">Create one free</Link>
      </p>
    </AuthShell>
  )
}
