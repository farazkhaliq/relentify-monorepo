'use client'

import { useState } from 'react'
import { useRecording } from './RecordingContext'

export function RecordingPanel() {
  const { state, uploadProgress, discardRecording, sendRecording } = useRecording()
  const [description, setDescription] = useState('')

  if (state !== 'reviewing' && state !== 'uploading' && state !== 'done') return null

  if (state === 'done') {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl shadow-lg p-4 w-72 text-sm">
        <p className="text-[var(--theme-text)] font-medium mb-1">Recording sent ✓</p>
        <p className="text-[var(--theme-text-muted)]">Our team will follow up shortly.</p>
        <button
          onClick={discardRecording}
          className="mt-3 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
        >
          Dismiss
        </button>
      </div>
    )
  }

  if (state === 'uploading') {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl shadow-lg p-4 w-72 text-sm">
        <p className="text-[var(--theme-text)] font-medium mb-2">Uploading…</p>
        <div className="w-full bg-[var(--theme-border)] rounded-full h-1.5">
          <div
            className="bg-[var(--theme-accent)] h-1.5 rounded-full transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="mt-1 text-[var(--theme-text-muted)]">{uploadProgress}%</p>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl shadow-lg p-4 w-80 text-sm">
      <p className="text-[var(--theme-text)] font-medium mb-2">Send recording</p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the issue (optional)"
        className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-background)] text-[var(--theme-text)] text-sm p-2 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={discardRecording}
          className="flex-1 py-1.5 rounded-md border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs transition-colors"
        >
          Discard
        </button>
        <button
          onClick={() => sendRecording(description)}
          className="flex-1 py-1.5 rounded-md bg-[var(--theme-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Send
        </button>
      </div>
    </div>
  )
}
