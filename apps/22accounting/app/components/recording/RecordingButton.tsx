'use client'

import { Video } from 'lucide-react'
import { useRecording } from './RecordingContext'

export function RecordingButton() {
  const { state, startRecording } = useRecording()
  if (state !== 'idle' && state !== 'error') return null

  return (
    <button
      onClick={() => startRecording(false)}
      title="Record screen to report an issue"
      className="p-2 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-card)] transition-colors"
    >
      <Video className="w-4 h-4" />
    </button>
  )
}
