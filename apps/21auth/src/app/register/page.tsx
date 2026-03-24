'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Card, Logo, Label, cn } from '@relentify/ui'
import { AuthShell } from '@/src/components/layout/AuthShell'

type Tier = 'invoicing' | 'sole_trader' | 'small_business' | 'medium_business' | 'corporate'

const PLANS: {
  tier: Tier
  label: string
  introPrice: string
  normalPrice: string
  description: string
  highlight?: boolean
}[] = [
  {
    tier: 'invoicing',
    label: 'Invoicing',
    introPrice: 'Free',
    normalPrice: 'Free forever',
    description: 'Unlimited invoices + card payments',
  },
  {
    tier: 'sole_trader',
    label: 'Sole Trader',
    introPrice: '£0.99/mo',
    normalPrice: '£4.99/mo',
    description: 'Invoicing + expenses, reports, bank reconciliation',
  },
  {
    tier: 'small_business',
    label: 'Small Business',
    introPrice: '£1.99/mo',
    normalPrice: '£12.50/mo',
    description: 'Sole Trader + MTD VAT, CIS, bill payments',
    highlight: true,
  },
  {
    tier: 'medium_business',
    label: 'Medium Business',
    introPrice: '£4.99/mo',
    normalPrice: '£29/mo',
    description: 'Small Business + multi-currency, custom branding, PO approvals',
  },
  {
    tier: 'corporate',
    label: 'Corporate',
    introPrice: '£8.99/mo',
    normalPrice: '£49/mo',
    description: 'Everything + multi-entity (3 included, +£20/entity)',
  },
]

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const affiliateId = searchParams.get('ref') || ''
  const refToken = searchParams.get('refToken') || ''

  const [step, setStep] = useState<'plan' | 'details'>('plan')
  const [selectedTier, setSelectedTier] = useState<Tier>('invoicing')
  const [isAccountant, setIsAccountant] = useState(false)
  const [firmName, setFirmName] = useState('')
  const [f, setF] = useState({ email: '', password: '', confirmPassword: '', fullName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function u(k: string, v: string) { setF(p => ({ ...p, [k]: v })) }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (f.password !== f.confirmPassword) { setError('Passwords do not match'); setLoading(false); return }
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.email,
          password: f.password,
          fullName: f.fullName,
          tier: isAccountant ? 'accountant' : selectedTier,
          userType: isAccountant ? 'accountant' : 'client',
          firmName: isAccountant ? firmName : undefined,
          affiliateId: affiliateId || undefined,
          refToken: refToken || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      router.push('/portal')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan = PLANS.find(p => p.tier === selectedTier)!

  return (
    <AuthShell maxWidth="max-w-2xl">
      <div className="text-center mb-10">
        <Logo className="mb-4" />
        <p className="text-[var(--theme-text-muted)] font-medium">
          {step === 'plan' ? 'Choose your plan' : isAccountant ? 'Creating your Accountant account' : `Creating your ${selectedPlan.label} account`}
        </p>
      </div>

      {step === 'plan' && (
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-4 border border-[var(--theme-border)] rounded-lg cursor-pointer hover:bg-[var(--theme-card)] mb-6">
            <input
              type="checkbox"
              checked={isAccountant}
              onChange={e => setIsAccountant(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <p className="font-medium text-sm text-[var(--theme-text)]">I&apos;m an accountant or bookkeeper</p>
              <p className="text-xs text-[var(--theme-text-muted)]">Manage multiple clients from one portal</p>
            </div>
          </label>

          {isAccountant ? (
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-[var(--theme-success)]/10 border border-[var(--theme-success)]/30 rounded-lg">
                <p className="text-sm text-[var(--theme-success)] font-medium">Accountant accounts are free</p>
                <p className="text-xs text-[var(--theme-success)] mt-1 opacity-80">No subscription required. Access your clients&apos; accounts from your portal.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--theme-text)]">Practice or firm name <span className="text-[var(--theme-text-dim)] font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={firmName}
                  onChange={e => setFirmName(e.target.value)}
                  placeholder="e.g. Smith & Co Accountants"
                  className="w-full border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm bg-[var(--theme-card)] text-[var(--theme-text)]"
                />
              </div>
            </div>
          ) : (
            <>
              {PLANS.map(plan => (
                <button
                  key={plan.tier}
                  type="button"
                  onClick={() => setSelectedTier(plan.tier)}
                  className={cn(
                    "w-full text-left p-5 rounded-full border transition-all duration-300",
                    selectedTier === plan.tier
                      ? "border-[var(--theme-accent)] bg-[var(--theme-accent)]/10"
                      : "border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent)]/40",
                    plan.highlight && "ring-1 ring-[var(--theme-accent)]/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedTier === plan.tier ? "border-[var(--theme-accent)]" : "border-[var(--theme-text-dim)]"
                      )}>
                        {selectedTier === plan.tier && <div className="w-2 h-2 rounded-full bg-[var(--theme-accent)]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--theme-text)] font-black text-[var(--theme-text-85)]">{plan.label}</span>
                          {plan.highlight && <span className="text-[var(--theme-text-9)] font-black uppercase tracking-widest text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 px-2 py-0.5 rounded-full border border-[var(--theme-accent)]/20">Popular</span>}
                        </div>
                        <p className="text-[var(--theme-text-muted)] text-[var(--theme-text-75)] mt-0.5">{plan.description}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[var(--theme-text)] font-black text-[var(--theme-text-85)]">{plan.introPrice}</p>
                      {plan.introPrice !== plan.normalPrice && plan.introPrice !== 'Free' && (
                        <p className="text-[var(--theme-text-dim)] text-[var(--theme-text-10)]">then {plan.normalPrice}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              <p className="text-center text-[var(--theme-text-75)] text-[var(--theme-text-muted)] pt-1">
                Intro prices valid for 6 months. Card processing: 2.5% + 20p.
              </p>
            </>
          )}

          <Button
            onClick={() => setStep('details')}
            className="w-full"
          >
            {isAccountant ? 'Continue as Accountant →' : `Continue with ${selectedPlan.label} →`}
          </Button>
        </div>
      )}

      {step === 'details' && (
        <Card className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--theme-border)]">
            <div>
              <p className="text-[var(--theme-text-10)] font-black text-[var(--theme-text-dim)] uppercase tracking-widest mb-1">Selected Plan</p>
              <p className="text-[var(--theme-text)] font-black">{isAccountant ? 'Accountant' : selectedPlan.label}</p>
            </div>
            <div className="text-right">
              <p className="text-[var(--theme-accent)] font-black">{isAccountant ? 'Free' : selectedPlan.introPrice}</p>
              {!isAccountant && selectedPlan.introPrice !== selectedPlan.normalPrice && selectedPlan.introPrice !== 'Free' && (
                <p className="text-[var(--theme-text-muted)] text-[var(--theme-text-75)]">then {selectedPlan.normalPrice}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('plan')}
            className="text-[var(--theme-text-10)] font-black text-[var(--theme-text-dim)] uppercase tracking-widest hover:text-[var(--theme-text-muted)] bg-transparent border-none cursor-pointer mb-6 block"
          >
            ← Change plan
          </button>

          {error && <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-full mb-6 text-[var(--theme-text-85)] font-bold">{error}</div>}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input type="text" required value={f.fullName} onChange={e => u('fullName', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required value={f.email} onChange={e => u('email', e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" required value={f.password} onChange={e => u('password', e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" required value={f.confirmPassword} onChange={e => u('confirmPassword', e.target.value)} placeholder="Re-enter password" />
            </div>
            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              {isAccountant ? 'Create Accountant Account' : selectedTier === 'invoicing' ? 'Create Free Account' : `Create Account & Pay`}
            </Button>
          </form>
        </Card>
      )}

      <p className="text-center text-[var(--theme-text-85)] text-[var(--theme-text-muted)] mt-8 font-medium">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--theme-accent)] hover:brightness-110 font-bold no-underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--theme-background)] flex items-center justify-center">
        <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
