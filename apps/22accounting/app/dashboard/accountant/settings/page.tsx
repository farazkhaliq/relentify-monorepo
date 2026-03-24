'use client'
import { useState, useEffect } from 'react'
import { Card, Button, Input, Label, PageHeader } from '@relentify/ui'

export default function AccountantSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    accountant_bank_account_name: '',
    accountant_sort_code: '',
    accountant_account_number: '',
  })

  useEffect(() => {
    fetch('/api/accountant/bank-details', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setForm({
          accountant_bank_account_name: data.accountant_bank_account_name || '',
          accountant_sort_code: data.accountant_sort_code || '',
          accountant_account_number: data.accountant_account_number || '',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const r = await fetch('/api/accountant/bank-details', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-[var(--theme-accent)]/20 border-t-[var(--theme-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          supertitle="ACCOUNTANT"
          title="Bank Details"
          className="mb-0"
        />
      </div>

      {error && (
        <div className="bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] px-4 py-3 rounded-cinematic text-sm font-bold">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 text-[var(--theme-accent)] px-4 py-3 rounded-cinematic text-sm font-bold">
          Bank details saved
        </div>
      )}

      <Card variant="default" padding="lg">
        <p className="text-[var(--theme-text-muted)] text-sm mb-6">
          For referral commission payments — paid manually by Relentify staff when your invited clients subscribe.
        </p>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label>Account name</Label>
            <Input
              type="text"
              value={form.accountant_bank_account_name}
              onChange={e => setForm(f => ({ ...f, accountant_bank_account_name: e.target.value }))}
              placeholder="John Smith"
            />
          </div>
          <div className="space-y-2">
            <Label>Sort code</Label>
            <Input
              type="text"
              value={form.accountant_sort_code}
              onChange={e => setForm(f => ({ ...f, accountant_sort_code: e.target.value }))}
              placeholder="00-00-00"
            />
          </div>
          <div className="space-y-2">
            <Label>Account number</Label>
            <Input
              type="text"
              value={form.accountant_account_number}
              onChange={e => setForm(f => ({ ...f, accountant_account_number: e.target.value }))}
              placeholder="12345678"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            variant="primary"
            className="rounded-cinematic uppercase tracking-widest text-sm font-black"
          >
            {saving ? 'Saving…' : 'Save bank details'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
