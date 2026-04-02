import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader, Card, CardHeader, CardContent, Badge } from '@relentify/ui'
import { FileSignature, Clock, CheckCircle2, XCircle } from 'lucide-react'
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

  const { rows } = await query(
    `SELECT id, token, title, signer_email, signer_name, status, created_at, signed_at
     FROM signing_requests
     WHERE created_by_user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [user.userId]
  )

  return (
    <div className="space-y-12">
      <PageHeader
        supertitle="RELENTIFY E-SIGN"
        title=""
        className="mb-0"
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--theme-border)] px-4 sm:px-8 md:px-12">
          <div className="flex items-center gap-3">
            <FileSignature size={18} className="text-[var(--theme-accent)]" />
            <span className="font-bold text-[var(--theme-text)] tracking-tight">Signing Requests</span>
            <span className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)]">{rows.length}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
              No signing requests yet
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
