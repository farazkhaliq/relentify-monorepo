'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Logo, Button, Card } from '@relentify/ui'
import { AuthShell } from '@/src/components/layout/AuthShell'

function AcceptContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<'loading' | 'ready' | 'accepting' | 'done' | 'error'>('loading')
  const [info, setInfo] = useState<{ clientName: string; accountantEmail: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('No token provided.'); return; }
    fetch(`/api/accountant/accept?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setInfo({ clientName: d.clientName, accountantEmail: d.accountantEmail }); setState('ready'); }
        else { setErrorMsg(d.error || 'Invalid invitation'); setState('error'); }
      })
      .catch(() => { setErrorMsg('Failed to load invitation'); setState('error'); })
  }, [token])

  async function accept() {
    setState('accepting')
    try {
      const r = await fetch('/api/accountant/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setState('done')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed')
      setState('error')
    }
  }

  return (
    <AuthShell>
      <div className="text-center mb-8">
        <Logo className="mb-4" />
      </div>

      <Card className="text-center">
        {state === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        )}

        {state === 'ready' && info && (
          <>
            <p className="text-[var(--theme-text-10)] font-black text-[var(--theme-accent)] uppercase tracking-widest mb-4">Accountant Invitation</p>
            <h2 className="text-xl font-black mb-2 text-[var(--theme-text)]">Accept invite from</h2>
            <p className="text-3xl font-black text-[var(--theme-accent)] mb-6">{info.clientName}</p>
            <p className="text-[var(--theme-text-muted)] text-[var(--theme-text-85)] mb-8">
              You&apos;ll be able to view {info.clientName}&apos;s financial data in read-only mode. Sent to <strong className="text-[var(--theme-text)]">{info.accountantEmail}</strong>.
            </p>
            <Button
              onClick={accept}
              className="w-full"
            >
              Accept Invitation →
            </Button>
          </>
        )}

        {state === 'accepting' && (
          <div className="flex items-center justify-center gap-3 py-8">
            <svg className="w-5 h-5 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="font-black text-[var(--theme-text)]">Accepting…</span>
          </div>
        )}

        {state === 'done' && (
          <>
            <div className="text-[var(--theme-accent)] text-5xl mb-4">✓</div>
            <h2 className="text-xl font-black mb-2 text-[var(--theme-text)]">Access granted</h2>
            <p className="text-[var(--theme-text-muted)] text-[var(--theme-text-85)] mb-8">You can now access your client&apos;s account from Relentify Accounts.</p>
            <a href="https://accounts.relentify.com" className="magnetic-btn inline-block px-8 py-3 bg-[var(--theme-accent)] text-[var(--theme-primary)] font-black rounded-full text-[var(--theme-text-85)] uppercase tracking-widest hover:brightness-110 transition-all no-underline shadow-cinematic shadow-[var(--theme-accent)]/20">
              Go to Accounts →
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-[var(--theme-destructive)] text-5xl mb-4">✕</div>
            <h2 className="text-xl font-black mb-2 text-[var(--theme-text)]">Invitation invalid</h2>
            <p className="text-[var(--theme-text-muted)] text-[var(--theme-text-85)] mb-8">{errorMsg || 'This invitation link is no longer valid.'}</p>
            <Link href="/" className="text-[var(--theme-text-10)] font-black text-[var(--theme-accent)] uppercase tracking-widest no-underline hover:text-[var(--theme-accent)]/80">
              ← Back to home
            </Link>
          </>
        )}
      </Card>
    </AuthShell>
  )
}

export default function AccountantAcceptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--theme-background)]">
        <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    }>
      <AcceptContent />
    </Suspense>
  )
}
