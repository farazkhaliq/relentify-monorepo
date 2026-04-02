'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label } from '@relentify/ui'
import { ArrowLeft, Send, Copy, Check } from 'lucide-react'
import Link from 'next/link'

export default function NewRequestPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    signerEmail: '',
    signerName: '',
    title: '',
    bodyText: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ signingUrl: string; id: string } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create request')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function copyUrl() {
    if (result) {
      navigator.clipboard.writeText(result.signingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-4">
        <Link href="/" className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
        </Link>
        <PageHeader supertitle="NEW SIGNING REQUEST" title="" className="mb-0" />
      </div>

      {result ? (
        <Card className="border-[var(--theme-success)]/30 bg-[var(--theme-success)]/5">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-[var(--theme-text)]">Signing request created</h3>
              <p className="text-sm text-[var(--theme-text-muted)]">Send this link to the signer. They'll verify their email and sign digitally.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg px-4 py-3 font-mono text-sm text-[var(--theme-text)] break-all">
                {result.signingUrl}
              </code>
              <button onClick={copyUrl} className="p-3 hover:bg-[var(--theme-border)] rounded-lg transition-colors shrink-0">
                {copied ? <Check size={16} className="text-[var(--theme-success)]" /> : <Copy size={16} />}
              </button>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setResult(null); setForm({ signerEmail: '', signerName: '', title: '', bodyText: '' }) }} className="text-xs">
                Create Another
              </Button>
              <Link href="/">
                <Button variant="primary" className="text-xs">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-[var(--theme-border)]">
            <CardTitle className="text-lg">Request Details</CardTitle>
            <CardDescription>Create a signing request and get a link to share</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Signer Email *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="tenant@example.com"
                    value={form.signerEmail}
                    onChange={e => setForm({ ...form, signerEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signer Name</Label>
                  <Input
                    placeholder="Jane Doe (optional)"
                    value={form.signerName}
                    onChange={e => setForm({ ...form, signerName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Document Title *</Label>
                <Input
                  required
                  placeholder="e.g. Property Inventory — 14 Oak Lane"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Legal Text *</Label>
                <textarea
                  required
                  rows={4}
                  placeholder="I, the undersigned, acknowledge..."
                  value={form.bodyText}
                  onChange={e => setForm({ ...form, bodyText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-[var(--theme-destructive)] text-sm font-bold">{error}</p>
              )}

              <Button type="submit" disabled={loading} variant="primary" className="w-full h-12 text-xs">
                <Send size={14} className="mr-2" />
                {loading ? 'Creating...' : 'Create Signing Request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
