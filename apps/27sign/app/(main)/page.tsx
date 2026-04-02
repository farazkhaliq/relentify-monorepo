import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { getOrCreateSubscription } from '@/lib/subscription'
import { TIER_LIMITS } from '@/lib/tiers'
import { redirect } from 'next/navigation'
import { PageHeader, Card, CardHeader, CardContent, Badge, StatsCard, Button } from '@relentify/ui'
import { FileSignature, Clock, CheckCircle2, XCircle, Rocket, ArrowRight, Send, Key } from 'lucide-react'
import Link from 'next/link'

const statusConfig: Record<string, { variant: 'accent' | 'success' | 'warning' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  pending: { variant: 'warning', icon: Clock },
  signed: { variant: 'success', icon: CheckCircle2 },
  expired: { variant: 'destructive', icon: XCircle },
  cancelled: { variant: 'outline', icon: XCircle },
}

export default async function DashboardPage() {
  const user = await getAuthUser()
  if (!user) redirect('/')

  const sub = await getOrCreateSubscription(user.userId)
  const limits = TIER_LIMITS[sub.tier]

  const { rows } = await query(
    `SELECT sr.id, sr.token, sr.title, sr.signer_email, sr.signer_name,
            sr.status, sr.created_at, sr.signed_at, sr.signing_mode,
            (SELECT COUNT(*) FROM signing_request_signers srs WHERE srs.signing_request_id = sr.id) AS signer_count,
            (SELECT COUNT(*) FILTER (WHERE srs.status = 'signed') FROM signing_request_signers srs WHERE srs.signing_request_id = sr.id) AS signed_count
     FROM signing_requests sr
     WHERE sr.created_by_user_id = $1
     ORDER BY sr.created_at DESC
     LIMIT 100`,
    [user.userId]
  )

  const { rows: keyRows } = await query(
    'SELECT COUNT(*) as n FROM api_keys WHERE user_id = $1 AND is_active = TRUE',
    [user.userId]
  )
  const keyCount = parseInt(keyRows[0]?.n || '0')

  const signed = rows.filter((r: any) => r.status === 'signed').length
  const pending = rows.filter((r: any) => r.status === 'pending').length
  const isFirstVisit = rows.length === 0 && keyCount === 0

  return (
    <div className="space-y-8">
      <PageHeader supertitle="RELENTIFY E-SIGN" title="" className="mb-0" />

      {/* First-visit onboarding banner */}
      {isFirstVisit && (
        <Card className="border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/5">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-[var(--theme-accent)]/10 flex items-center justify-center shrink-0">
                <Rocket size={24} className="text-[var(--theme-accent)]" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-[var(--theme-text)] mb-1">Welcome to Relentify E-Sign</h3>
                <p className="text-[var(--theme-text-muted)] text-sm">
                  Legally binding digital signatures in 4 steps. Generate an API key, create a signing request, and we handle the rest — OTP verification, signature capture, and tamper-evident audit trails.
                </p>
              </div>
              <Link href="/getting-started" className="no-underline shrink-0">
                <Button variant="primary" className="text-xs">
                  Get Started <ArrowRight size={12} className="ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Requests"
          value={`${sub.requestsThisMonth}/${limits.requestsPerMonth === Infinity ? '∞' : limits.requestsPerMonth}`}
          icon={Send}
        />
        <StatsCard label="Signed" value={signed} icon={CheckCircle2} />
        <StatsCard label="Pending" value={pending} icon={Clock} />
        <StatsCard label="API Keys" value={`${keyCount}/${limits.apiKeys}`} icon={Key} />
      </div>

      {/* Signing requests list */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--theme-border)] px-4 sm:px-8 md:px-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature size={18} className="text-[var(--theme-accent)]" />
              <span className="font-bold text-[var(--theme-text)] tracking-tight">Signing Requests</span>
              <span className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)]">{rows.length}</span>
            </div>
            <Link href="/requests/new" className="no-underline">
              <Button variant="primary" className="text-xs">
                + New Request
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <p className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
                No signing requests yet
              </p>
              <p className="text-[var(--theme-text-muted)] text-sm">
                Create your first request via the API or the button above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--theme-border)]">
              {rows.map((row: any) => {
                const cfg = statusConfig[row.status] || statusConfig.pending
                const StatusIcon = cfg.icon
                return (
                  <Link
                    key={row.id}
                    href={`/requests/${row.id}`}
                    className="flex items-center gap-4 px-4 sm:px-8 md:px-12 py-5 hover:bg-[var(--theme-border)]/30 transition-colors no-underline"
                  >
                    <StatusIcon size={16} className="text-[var(--theme-text-muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[var(--theme-text)] truncate text-sm">{row.title}</p>
                      <p className="text-[var(--theme-text-dim)] text-xs font-mono truncate">{row.signer_email}</p>
                    </div>
                    {row.signing_mode && row.signing_mode !== 'single' && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">{row.signing_mode}</Badge>
                    )}
                    {parseInt(row.signer_count) > 1 && (
                      <span className="text-[var(--theme-text-dim)] font-mono text-[10px] shrink-0">
                        {row.signed_count}/{row.signer_count}
                      </span>
                    )}
                    <Badge variant={cfg.variant} className="shrink-0">{row.status}</Badge>
                    <span className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] shrink-0 hidden sm:block">
                      {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
