import { PageHeader, Card, CardHeader, CardContent, CardTitle, Badge } from '@relentify/ui'
import { Code2, Send, ShieldCheck, FileSignature, Webhook } from 'lucide-react'

export default function DocsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader supertitle="API DOCUMENTATION" title="" className="mb-0" />

      {/* Base URL */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code2 size={16} className="text-[var(--theme-accent)]" /> Base URL & Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <code className="block bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-sm text-[var(--theme-text)]">
            https://esign.relentify.com/api/v1
          </code>
          <p className="text-sm text-[var(--theme-text-muted)]">
            All API calls require a Bearer token in the Authorization header:
          </p>
          <code className="block bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-sm text-[var(--theme-text)]">
            Authorization: Bearer rs_live_your_api_key_here
          </code>
        </CardContent>
      </Card>

      {/* Create Signing Request */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send size={16} className="text-[var(--theme-accent)]" />
            POST /api/v1/requests
            <Badge variant="accent">Create</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-[var(--theme-text-muted)]">Create a new signing request. Returns a signing URL to send to the signer.</p>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-2">Request Body</p>
            <pre className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-xs text-[var(--theme-text)] overflow-x-auto">{`{
  "signerEmail": "tenant@example.com",     // required
  "signerName": "Jane Doe",                // optional
  "title": "Property Inventory — 14 Oak Lane",  // required
  "bodyText": "I acknowledge the property...",   // required (legal text shown to signer)
  "callbackUrl": "https://your-app.com/webhooks/signing",  // optional
  "callbackSecret": "whsec_your_secret",   // optional (for HMAC verification)
  "metadata": { "orderId": "123" },        // optional (returned in webhook)
  "expiresInDays": 30,                     // optional (default 30)
  "createdByUserId": "user-uuid"           // optional (for dashboard scoping)
}`}</pre>
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-2">Response (201)</p>
            <pre className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-xs text-[var(--theme-text)] overflow-x-auto">{`{
  "id": "uuid",
  "token": "url-safe-token",
  "signingUrl": "https://esign.relentify.com/s/url-safe-token",
  "status": "pending",
  "expiresAt": "2026-05-02T..."
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Get Status */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature size={16} className="text-[var(--theme-accent)]" />
            GET /api/v1/requests/:id
            <Badge variant="outline">Read</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-[var(--theme-text-muted)]">Check the status of a signing request.</p>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-2">Response (200)</p>
            <pre className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-xs text-[var(--theme-text)] overflow-x-auto">{`{
  "id": "uuid",
  "status": "pending | signed | expired | cancelled",
  "signer_email": "tenant@example.com",
  "signed_at": "2026-04-02T..." // null if not signed
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook size={16} className="text-[var(--theme-accent)]" /> Webhook Callback
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-[var(--theme-text-muted)]">
            After signing completes, we POST to your <code className="text-[var(--theme-accent)]">callbackUrl</code> with the signature data.
            Verify the <code className="text-[var(--theme-accent)]">X-Signature-256</code> header using HMAC-SHA256 with your <code className="text-[var(--theme-accent)]">callbackSecret</code>.
          </p>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-2">Webhook Payload</p>
            <pre className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-xs text-[var(--theme-text)] overflow-x-auto">{`{
  "event": "signing.completed",
  "signingRequestId": "uuid",
  "signerEmail": "tenant@example.com",
  "signedAt": "2026-04-02T14:30:00Z",
  "signatureImageBase64": "data:image/png;base64,...",
  "metadata": { "orderId": "123" }  // your original metadata
}`}</pre>
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-2">Verify Signature (Node.js)</p>
            <pre className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-xs text-[var(--theme-text)] overflow-x-auto">{`const crypto = require('crypto')
const expected = crypto
  .createHmac('sha256', 'whsec_your_secret')
  .update(requestBody)
  .digest('hex')
if (req.headers['x-signature-256'] !== expected) {
  return res.status(401).json({ error: 'Invalid signature' })
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--theme-accent)]" /> Security & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-sm text-[var(--theme-text-muted)]">
          <p><strong className="text-[var(--theme-text)]">Email OTP verification</strong> — signers verify identity with a 6-digit code before signing</p>
          <p><strong className="text-[var(--theme-text)]">Hash-chained audit log</strong> — tamper-evident SHA-256 chain for every event</p>
          <p><strong className="text-[var(--theme-text)]">RFC 3161 timestamps</strong> — independent third-party proof of signing time</p>
          <p><strong className="text-[var(--theme-text)]">Document integrity</strong> — SHA-256 hash of document text verified at signing time</p>
          <p><strong className="text-[var(--theme-text)]">Compliance</strong> — UK ECA 2000, eIDAS SES/AES, US ESIGN Act</p>
        </CardContent>
      </Card>
    </div>
  )
}
