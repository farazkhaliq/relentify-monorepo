'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, CardHeader, CardContent, CardTitle, CardDescription, Badge, Button } from '@relentify/ui'
import { Key, Trash2, Plus, CreditCard, Zap, Copy, Check, Eye, EyeOff } from 'lucide-react'

interface ApiKey {
  id: string
  app_id: string
  key_prefix: string
  label: string | null
  is_active: boolean
  request_count: number
  created_at: string
}

interface Subscription {
  tier: string
  status: string
  requestsThisMonth: number
  requestLimit: number
  apiKeyLimit: number
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [sub, setSub] = useState<Subscription | null>(null)
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')

  useEffect(() => {
    fetch('/api/settings/keys').then(r => r.json()).then(d => setKeys(d.keys || []))
    fetch('/api/settings/subscription').then(r => r.json()).then(setSub)
  }, [])

  async function createKey() {
    setCreating(true)
    const res = await fetch('/api/settings/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || 'My API Key', appId: 'custom' }),
    })
    const data = await res.json()
    if (res.ok) {
      setNewKeySecret(data.secretKey)
      setKeys(prev => [data.key, ...prev])
      setLabel('')
    } else {
      alert(data.error)
    }
    setCreating(false)
  }

  async function deleteKey(id: string) {
    if (!confirm('Deactivate this API key?')) return
    await fetch(`/api/settings/keys/${id}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  async function upgrade(tier: string) {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert(data.error || 'Failed to create checkout session')
  }

  function copyKey() {
    if (newKeySecret) {
      navigator.clipboard.writeText(newKeySecret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tierColors: Record<string, string> = {
    free: 'outline', personal: 'accent', standard: 'success', business_pro: 'warning',
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader supertitle="SETTINGS" title="" className="mb-0" />

      {/* Subscription */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard size={16} className="text-[var(--theme-accent)]" /> Billing
              </CardTitle>
              <CardDescription>Your current plan and usage</CardDescription>
            </div>
            {sub && <Badge variant={(tierColors[sub.tier] as any) || 'outline'}>{sub.tier}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {sub && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-1">Requests this month</p>
                  <p className="text-2xl font-bold text-[var(--theme-text)]">
                    {sub.requestsThisMonth} <span className="text-sm text-[var(--theme-text-dim)]">/ {sub.requestLimit === Infinity ? '∞' : sub.requestLimit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-1">API Keys</p>
                  <p className="text-2xl font-bold text-[var(--theme-text)]">
                    {keys.filter(k => k.is_active).length} <span className="text-sm text-[var(--theme-text-dim)]">/ {sub.apiKeyLimit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--theme-text-dim)] mb-1">Status</p>
                  <Badge variant={sub.status === 'active' ? 'success' : 'warning'}>{sub.status}</Badge>
                </div>
              </div>

              {sub.tier === 'free' && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="primary" onClick={() => upgrade('personal')} className="text-xs">
                    <Zap size={12} className="mr-2" /> Upgrade to Personal — £5/mo
                  </Button>
                  <Button variant="outline" onClick={() => upgrade('standard')} className="text-xs">
                    Upgrade to Standard — £12/mo
                  </Button>
                  <Button variant="outline" onClick={() => upgrade('business_pro')} className="text-xs">
                    Upgrade to Business Pro — £22/mo
                  </Button>
                </div>
              )}
              {sub.tier === 'personal' && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="primary" onClick={() => upgrade('standard')} className="text-xs">
                    <Zap size={12} className="mr-2" /> Upgrade to Standard — £12/mo
                  </Button>
                  <Button variant="outline" onClick={() => upgrade('business_pro')} className="text-xs">
                    Upgrade to Business Pro — £22/mo
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* New Key Secret Banner */}
      {newKeySecret && (
        <Card className="border-[var(--theme-accent)] bg-[var(--theme-accent)]/5">
          <CardContent className="p-6 space-y-3">
            <p className="font-bold text-[var(--theme-text)]">Your new API key (shown once):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg px-4 py-2 font-mono text-sm text-[var(--theme-text)] break-all">
                {showSecret ? newKeySecret : newKeySecret.substring(0, 15) + '•'.repeat(40)}
              </code>
              <button onClick={() => setShowSecret(!showSecret)} className="p-2 hover:bg-[var(--theme-border)] rounded-lg transition-colors">
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={copyKey} className="p-2 hover:bg-[var(--theme-border)] rounded-lg transition-colors">
                {copied ? <Check size={16} className="text-[var(--theme-success)]" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-[var(--theme-text-dim)]">Copy this key now. You won't be able to see it again.</p>
          </CardContent>
        </Card>
      )}

      {/* API Keys */}
      <Card>
        <CardHeader className="border-b border-[var(--theme-border)]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key size={16} className="text-[var(--theme-accent)]" /> API Keys
              </CardTitle>
              <CardDescription>Manage your API keys for programmatic access</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-3">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Key label (e.g. My App)"
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] text-sm"
            />
            <Button onClick={createKey} disabled={creating} variant="primary" className="text-xs shrink-0">
              <Plus size={12} className="mr-2" /> Generate Key
            </Button>
          </div>

          {keys.length === 0 ? (
            <p className="text-center text-[var(--theme-text-dim)] py-8 font-mono text-xs uppercase tracking-widest">No API keys yet</p>
          ) : (
            <div className="divide-y divide-[var(--theme-border)]">
              {keys.map(key => (
                <div key={key.id} className="flex items-center gap-4 py-3">
                  <Key size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--theme-text)]">{key.label || key.app_id}</p>
                    <p className="text-xs font-mono text-[var(--theme-text-dim)]">{key.key_prefix}... · {key.request_count} requests</p>
                  </div>
                  <span className="text-xs text-[var(--theme-text-dim)] hidden sm:block">
                    {new Date(key.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="p-2 hover:bg-[var(--theme-destructive)]/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
