'use client'

import { useEffect, useState } from 'react'

interface Recording {
  id: string
  filename: string
  description: string | null
  sizeBytes: number
  createdAt: string
  expiresAt: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/recordings')
      .then((r) => r.json())
      .then((data) => setRecordings(data.recordings ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-[var(--theme-text)] mb-1">My Recordings</h1>
      <p className="text-sm text-[var(--theme-text-muted)] mb-6">
        Screen recordings you have sent to support. Available for 30 days.
      </p>

      {loading && (
        <p className="text-sm text-[var(--theme-text-muted)]">Loading…</p>
      )}

      {!loading && recordings.length === 0 && (
        <p className="text-sm text-[var(--theme-text-muted)]">
          No recordings yet. Use the camera icon in the top bar to record and report an issue.
        </p>
      )}

      <div className="space-y-4">
        {recordings.map((rec) => (
          <div
            key={rec.id}
            className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="text-sm font-medium text-[var(--theme-text)]">
                  {rec.description || 'No description'}
                </p>
                <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                  Recorded {formatDate(rec.createdAt)} · {formatBytes(rec.sizeBytes)} · Expires {formatDate(rec.expiresAt)}
                </p>
              </div>
              <button
                onClick={() => setActiveId(activeId === rec.id ? null : rec.id)}
                className="text-xs px-3 py-1.5 rounded-md border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors shrink-0"
              >
                {activeId === rec.id ? 'Hide' : 'View'}
              </button>
            </div>

            {activeId === rec.id && (
              <video
                src={`/api/recordings/${rec.id}/stream`}
                controls
                // Prevent browser download button and picture-in-picture
                controlsList="nodownload nofullscreen"
                disablePictureInPicture
                className="w-full rounded-lg mt-2 bg-black"
                style={{ maxHeight: '400px' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
