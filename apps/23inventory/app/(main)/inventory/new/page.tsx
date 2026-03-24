'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Sparkles, Home, User, Mail, FileText } from 'lucide-react'
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Input,
  Textarea,
  Label,
  PageHeader
} from '@relentify/ui'

const types = [
  { id: 'check-in', label: 'Check-In', description: 'Initial Asset Audit' },
  { id: 'check-out', label: 'Check-Out', description: 'Terminal Verification' },
]

export default function NewInventoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    propertyAddress: '',
    type: 'check-in',
    createdBy: '',
    notes: '',
    tenantEmail: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.propertyAddress || !form.createdBy) {
      setError('Property address and agent name are required.');
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/inventories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) throw new Error('Failed to initialise record')
      const data = await res.json()
      router.push(`/inventory/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System Failure')
      setLoading(false)
    }
  }

  return (
    <div className="p-8 lg:p-12 max-w-4xl mx-auto space-y-12">
      <div className="space-y-6">
        <Link href="/" className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
          Hub
        </Link>
        <PageHeader supertitle="Asset Creation" title="New Inventory" className="mb-0" />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--theme-border)] pb-8">
          <CardTitle className="text-xl tracking-tight">System Configuration</CardTitle>
          <CardDescription>Define record parameters</CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <Label className="flex items-center gap-2"><Home size={12} className="text-[var(--theme-accent)]" /> Property Address</Label>
                <Input
                  required
                  placeholder="e.g. 124 Neural Drive, Silicon Valley"
                  value={form.propertyAddress}
                  onChange={e => setForm({ ...form, propertyAddress: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2"><Sparkles size={12} className="text-[var(--theme-accent)]" /> Protocol Type</Label>
                <div className="grid grid-cols-2 gap-4">
                  {types.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.id })}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-cinematic border transition-all duration-500 group ${
                        form.type === t.id 
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/5 text-[var(--theme-accent)]' 
                          : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)]'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full transition-all duration-500 ${form.type === t.id ? 'bg-[var(--theme-accent)] scale-150' : 'bg-[var(--theme-text-dim)]'}`} />
                      <span className="mt-2 text-[var(--theme-text-10)] font-bold uppercase tracking-widest">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2"><User size={12} className="text-[var(--theme-accent)]" /> Reporting Agent</Label>
                <Input
                  required
                  placeholder="Full name"
                  value={form.createdBy}
                  onChange={e => setForm({ ...form, createdBy: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2"><Mail size={12} className="text-[var(--theme-accent)]" /> Stakeholder Email</Label>
                <Input
                  type="email"
                  placeholder="tenant@example.com (optional)"
                  value={form.tenantEmail}
                  onChange={e => setForm({ ...form, tenantEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2"><FileText size={12} className="text-[var(--theme-accent)]" /> Intelligence Notes</Label>
              <Textarea
                placeholder="Additional observations..."
                className="min-h-[var(--theme-size-120)]"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] text-[var(--theme-text-75)] font-mono uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="pt-6 flex justify-end">
              <Button type="submit" disabled={loading} size="lg" className="min-w-[var(--theme-size-240)] shadow-cinematic shadow-[var(--theme-accent)]/20">
                {loading ? 'Processing...' : (
                  <span className="flex items-center gap-2"><Save size={18} /> Initialise Record</span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
