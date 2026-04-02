import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { PageHeader, Card, CardHeader, CardContent, CardTitle, CardDescription, Badge, Button } from '@relentify/ui'
import { ArrowLeft, ShieldCheck, Clock, CheckCircle2, Mail, Eye, Send } from 'lucide-react'
import Link from 'next/link'

const actionIcons: Record<string, typeof Clock> = {
  created: Clock,
  otp_sent: Mail,
  otp_verified: ShieldCheck,
  viewed: Eye,
  signed: CheckCircle2,
  webhook_sent: Send,
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) redirect('/')

  const { rows: reqRows } = await query(
    `SELECT sr.*, s.image_data as signature_image
     FROM signing_requests sr
     LEFT JOIN signatures s ON sr.signature_id = s.id
     WHERE sr.id = $1 AND sr.created_by_user_id = $2`,
    [id, user.userId]
  )
  if (reqRows.length === 0) notFound()
  const req = reqRows[0]

  const { rows: auditRows } = await query(
    'SELECT * FROM audit_log WHERE signing_request_id = $1 ORDER BY created_at ASC',
    [id]
  )

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/" className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
        </Link>
        <PageHeader supertitle="Signing Request" title={req.title} className="mb-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b border-[var(--theme-border)]">
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Signer</p>
              <p className="font-bold text-[var(--theme-text)]">{req.signer_name || req.signer_email}</p>
              <p className="text-[var(--theme-text-muted)] text-sm">{req.signer_email}</p>
            </div>
            <div>
              <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Status</p>
              <Badge variant={req.status === 'signed' ? 'success' : req.status === 'pending' ? 'warning' : 'destructive'}>
                {req.status}
              </Badge>
            </div>
            <div>
              <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Created</p>
              <p className="text-[var(--theme-text)]">{new Date(req.created_at).toLocaleString('en-GB')}</p>
            </div>
            {req.signed_at && (
              <div>
                <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Signed</p>
                <p className="text-[var(--theme-text)]">{new Date(req.signed_at).toLocaleString('en-GB')}</p>
              </div>
            )}
            {req.status === 'signed' && (
              <Link href={`/certificate/${req.token}`} target="_blank">
                <Button variant="outline" className="w-full mt-4">View Certificate of Completion</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {req.signature_image && (
          <Card>
            <CardHeader className="border-b border-[var(--theme-border)]">
              <CardTitle className="text-lg">Signature</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-center">
              <img
                src={req.signature_image}
                alt="Captured signature"
                className="max-h-32 border border-[var(--theme-border)] rounded-lg p-2 bg-white"
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <CardTitle className="text-lg">Audit Trail</CardTitle>
          <CardDescription>Hash-chained, tamper-evident event log</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--theme-border)]">
            {auditRows.map((entry: any) => {
              const Icon = actionIcons[entry.action] || Clock
              return (
                <div key={entry.id} className="flex items-start gap-4 px-6 py-4">
                  <Icon size={14} className="text-[var(--theme-accent)] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--theme-text)]">{entry.action.replace(/_/g, ' ')}</p>
                    {entry.ip && <p className="text-xs text-[var(--theme-text-dim)]">IP: {entry.ip}</p>}
                  </div>
                  <span className="text-[var(--theme-text-dim)] font-mono text-[10px] shrink-0">
                    {new Date(entry.created_at).toLocaleString('en-GB')}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
