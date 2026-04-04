'use client'

import { useState, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import SignatureCapture from './SignatureCapture'

interface FieldModalProps {
  field: { id: string; field_type: string; label: string | null }
  token: string
  sessionToken: string
  onComplete: (fieldId: string, value: string) => void
  onClose: () => void
}

export default function FieldModal({
  field,
  token,
  sessionToken,
  onComplete,
  onClose,
}: FieldModalProps) {
  const [value, setValue] = useState<string>(
    field.field_type === 'date' ? new Date().toISOString().split('T')[0] : ''
  )
  const [sigData, setSigData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignatureType = field.field_type === 'signature' || field.field_type === 'initials'

  const submit = useCallback(async (val: string) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/esign/sign/${token}/fill-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ fieldId: field.id, value: val }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save field')
      }
      onComplete(field.id, val)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [token, sessionToken, field.id, onComplete])

  const handleConfirm = () => {
    if (isSignatureType) {
      if (sigData) submit(sigData)
    } else if (value.trim()) {
      submit(value.trim())
    }
  }

  const handleSignatureChange = (data: string | null) => {
    setSigData(data)
    // Auto-submit when a signature is selected
    if (data) submit(data)
  }

  const label = field.label || (field.field_type === 'signature' ? 'Signature' : field.field_type === 'initials' ? 'Initials' : field.field_type === 'date' ? 'Date' : 'Text')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1 transition-colors hover:opacity-70"
          style={{ color: 'var(--theme-text-muted)' }}
          disabled={submitting}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <h3
          className="mb-4 text-lg font-semibold"
          style={{ color: 'var(--theme-text)' }}
        >
          {label}
        </h3>

        {/* Error */}
        {error && (
          <p className="mb-3 text-sm" style={{ color: 'var(--theme-destructive)' }}>
            {error}
          </p>
        )}

        {/* Field content */}
        {isSignatureType ? (
          <div className="relative">
            {submitting && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--theme-card)', opacity: 0.8 }}>
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--theme-accent)' }} />
              </div>
            )}
            <SignatureCapture
              token={token}
              onSignatureChange={handleSignatureChange}
            />
          </div>
        ) : field.field_type === 'date' ? (
          <div className="space-y-4">
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                backgroundColor: 'var(--theme-background)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            />
            <button
              onClick={handleConfirm}
              disabled={!value || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-40"
              style={{
                backgroundColor: 'var(--theme-accent)',
                color: 'var(--theme-text)',
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field.label || 'Enter text...'}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                backgroundColor: 'var(--theme-background)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              autoFocus
            />
            <button
              onClick={handleConfirm}
              disabled={!value.trim() || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-40"
              style={{
                backgroundColor: 'var(--theme-accent)',
                color: 'var(--theme-text)',
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
