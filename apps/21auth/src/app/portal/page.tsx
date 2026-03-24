export const metadata = { title: 'Relentify — All Apps' }

import { redirect } from 'next/navigation'
import { getAuthUser } from '@/src/lib/auth'
import pool from '@/src/lib/db'
import Link from 'next/link'
import { Logo, cn, Card } from '@relentify/ui'
import { AuthShell } from '@/src/components/layout/AuthShell'

const APPS = [
  {
    key: 'accounts',
    name: 'Accounting',
    description: 'Invoicing, customers, Stripe payments',
    url: process.env.ACCOUNTS_URL || 'https://accounting.relentify.com',
    icon: '📊',
  },
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Property check-ins, check-outs, reports',
    url: process.env.INVENTORY_URL || 'https://inventory.relentify.com',
    icon: '🏠',
  },
  {
    key: 'crm',
    name: 'CRM',
    description: 'Lead management, property CRM',
    url: process.env.CRM_URL || 'https://crm.relentify.com',
    icon: '🤝',
  },
  {
    key: 'reminders',
    name: 'Reminders',
    description: 'Task management, momentum, reminders',
    url: process.env.REMINDERS_URL || 'https://reminders.relentify.com',
    icon: '⏰',
  },
]

export default async function PortalPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const { rows: accessRows } = await pool.query(
    'SELECT app FROM app_access WHERE user_id = $1',
    [user.userId]
  )
  const access = new Set(accessRows.map((r: { app: string }) => r.app))

  const { rows: userRows } = await pool.query(
    'SELECT full_name FROM users WHERE id = $1',
    [user.userId]
  )
  const fullName = userRows[0]?.full_name || user.email

  return (
    <AuthShell maxWidth="max-w-2xl">
      <div className="flex items-center justify-between mb-12">
        <Logo showText={true} />
        <div className="flex items-center gap-4">
          <span className="text-[var(--theme-text-muted)] text-[var(--theme-text-80)] font-medium">Hi, {fullName.split(' ')[0]}</span>
          <a href="/api/auth/logout" className="text-[var(--theme-text-70)] font-black text-[var(--theme-text-dim)] hover:text-[var(--theme-destructive)] uppercase tracking-widest transition-colors no-underline">Sign Out</a>
        </div>
      </div>

      <h1 className="text-4xl font-black text-[var(--theme-text)] mb-2 tracking-tight">Your Apps</h1>
      <p className="text-[var(--theme-text-muted)] mb-10 font-medium">Select a product to get started</p>

      <div className="grid gap-4">
        {APPS.map(app => {
          const hasAccess = access.has(app.key)
          return (
            <Card 
              key={app.key} 
              padding="lg"
              className={cn(
                "transition-all duration-700",
                hasAccess 
                  ? "hover:border-[var(--theme-accent)]/40 hover:shadow-cinematic" 
                  : "opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <span className="text-4xl bg-[var(--theme-background)] w-16 h-16 flex items-center justify-center rounded-cinematic">{app.icon}</span>
                  <div>
                    <div className="font-black text-[var(--theme-text)] text-xl">{app.name}</div>
                    <div className="text-[var(--theme-text-muted)] text-[var(--theme-text-85)] mt-1 font-medium">{app.description}</div>
                  </div>
                </div>
                {hasAccess ? (
                  <a 
                    href={app.url} 
                    className="magnetic-btn bg-[var(--theme-accent)] hover:brightness-110 text-[var(--theme-primary)] font-black text-[var(--theme-text-70)] px-8 py-3.5 rounded-full uppercase tracking-widest transition-all whitespace-nowrap shadow-cinematic no-underline"
                  >
                    Open Product →
                  </a>
                ) : (
                  <div className="text-right">
                    <div className="text-[var(--theme-text-10)] text-[var(--theme-text-dim)] uppercase tracking-widest font-black mb-3">Subscription Required</div>
                    <a
                      href={`https://relentify.com/waitlist?product=${app.key}`}
                      className="border border-[var(--theme-accent)]/30 text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 font-black text-[var(--theme-text-10)] px-6 py-2.5 rounded-full uppercase tracking-widest transition-all whitespace-nowrap inline-block no-underline"
                    >
                      Join Waitlist
                    </a>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </AuthShell>
  )
}
