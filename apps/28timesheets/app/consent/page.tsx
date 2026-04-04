'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@relentify/ui'
import { Shield, ChevronDown } from 'lucide-react'

export default function ConsentPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const handleConsent = async () => {
    setSubmitting(true)
    await fetch('/api/consent', { method: 'POST' })
    router.push('/worker')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={24} className="text-[var(--theme-accent)]" />
          <h1 className="text-xl font-bold">Location & Data Collection</h1>
        </div>

        <p className="text-sm text-[var(--theme-text-muted)] mb-4">
          Your employer requires location verification for timesheets. Your GPS coordinates are recorded
          at clock-in, clock-out, breaks, and periodically during shifts. Your IP address and device
          information are also recorded. This data is visible to your manager and stored according to
          your employer&apos;s retention settings (default 90 days).
        </p>

        <Button onClick={handleConsent} disabled={submitting} className="w-full mb-3">
          {submitting ? 'Recording...' : 'I understand and consent'}
        </Button>

        <button
          onClick={() => setShowMore(!showMore)}
          className="text-xs text-[var(--theme-accent)] flex items-center gap-1 mx-auto"
        >
          Learn more <ChevronDown size={12} className={showMore ? 'rotate-180' : ''} />
        </button>

        {showMore && (
          <div className="mt-3 text-xs text-[var(--theme-text-muted)] space-y-2">
            <p><strong>Your rights under GDPR:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Right of access — request a copy of your data at any time</li>
              <li>Right to erasure — request deletion of your data</li>
              <li>Right to data portability — export your data in CSV format</li>
              <li>Right to withdraw consent — you may withdraw at any time by contacting your employer</li>
            </ul>
            <p>GPS data is used solely for timesheet verification. It is not shared with third parties.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
