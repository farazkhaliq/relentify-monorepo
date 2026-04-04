import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { PageHeader, Card, CardHeader, CardContent, CardTitle, CardDescription, Badge, Button } from '@relentify/ui'
import { ArrowLeft, ShieldCheck, Clock, CheckCircle2, Mail, Eye, Send, FileText, Download, Users } from 'lucide-react'
import Link from 'next/link'

const actionIcons: Record<string, typeof Clock> = {
  created: Clock,
  otp_sent: Mail,
  otp_verified: ShieldCheck,
  viewed: Eye,
  signed: CheckCircle2,
  webhook_sent: Send,
}

const signerStatusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  signed: 'success',
  pending: 'warning',
  declined: 'destructive',
}

const modeVariant: Record<string, 'accent' | 'outline'> = {
  single: 'outline',
  parallel: 'accent',
  sequential: 'accent',
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

  // Fetch document info if available
  let doc: any = null
  if (req.document_id) {
    const { rows: docRows } = await query(
      'SELECT id, original_filename, page_count FROM documents WHERE id = $1',
      [req.document_id]
    )
    if (docRows.length > 0) doc = docRows[0]
  }

  // Fetch signers
  const { rows: signerRows } = await query(
    `SELECT id, email, name, sign_order, status, signed_at
     FROM signing_request_signers
     WHERE signing_request_id = $1
     ORDER BY sign_order ASC, created_at ASC`,
    [id]
  )

  const { rows: auditRows } = await query(
    'SELECT * FROM audit_log WHERE signing_request_id = $1 ORDER BY created_at ASC',
    [id]
  )

  const signingMode = req.signing_mode || 'single'

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/" className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <PageHeader supertitle="Signing Request" title={req.title} className="mb-0 flex-1" />
          <Badge variant={modeVariant[signingMode] || 'outline'} className="shrink-0">
            {signingMode}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b border-[var(--theme-border)]">
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Legacy single-signer info */}
            {req.signer_email && signerRows.length === 0 && (
              <div>
                <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Signer</p>
                <p className="font-bold text-[var(--theme-text)]">{req.signer_name || req.signer_email}</p>
                <p className="text-[var(--theme-text-muted)] text-sm">{req.signer_email}</p>
              </div>
            )}
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

        {/* Document info card */}
        {doc && (
          <Card>
            <CardHeader className="border-b border-[var(--theme-border)]">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText size={16} /> Document
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Filename</p>
                <p className="font-bold text-[var(--theme-text)] truncate">{doc.original_filename}</p>
              </div>
              {doc.page_count && (
                <div>
                  <p className="text-[var(--theme-text-dim)] text-xs font-mono uppercase tracking-widest mb-1">Pages</p>
                  <p className="text-[var(--theme-text)]">{doc.page_count}</p>
                </div>
              )}
              {req.all_signed && (
                <Link href={`/api/documents/${doc.id}/signed-pdf`} target="_blank">
                  <Button variant="primary" className="w-full mt-2 flex items-center justify-center gap-2">
                    <Download size={14} /> Download Signed PDF
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

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

      {/* Signers card (multi-signer) */}
      {signerRows.length > 0 && (
        <Card>
          <CardHeader className="border-b border-[var(--theme-border)]">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users size={16} /> Signers
              <span className="text-[var(--theme-text-dim)] font-mono text-xs ml-auto">
                {signerRows.filter((s: any) => s.status === 'signed').length}/{signerRows.length} signed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--theme-border)]">
              {signerRows.map((signer: any) => (
                <div key={signer.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--theme-text)] truncate">
                      {signer.name || signer.email}
                    </p>
                    {signer.name && (
                      <p className="text-xs text-[var(--theme-text-dim)] truncate">{signer.email}</p>
                    )}
                    {signingMode === 'sequential' && (
                      <p className="text-[10px] text-[var(--theme-text-dim)] font-mono">Order: {signer.sign_order + 1}</p>
                    )}
                  </div>
                  <Badge variant={signerStatusVariant[signer.status] || 'outline'} className="shrink-0">
                    {signer.status}
                  </Badge>
                  {signer.signed_at && (
                    <span className="text-[var(--theme-text-dim)] font-mono text-[10px] shrink-0 hidden sm:block">
                      {new Date(signer.signed_at).toLocaleString('en-GB')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
