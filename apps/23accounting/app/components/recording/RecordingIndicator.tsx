'use client'

import { Square } from 'lucide-react'
import { useRecording } from './RecordingContext'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordingIndicator() {
  const { state, elapsedSeconds, stopRecording } = useRecording()
  if (state !== 'recording') return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-[var(--theme-destructive)] text-white px-3 py-2 rounded-full shadow-lg text-sm font-medium">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      {formatTime(elapsedSeconds)}
      <button
        onClick={stopRecording}
        className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors"
        title="Stop recording"
      >
        <Square className="w-3 h-3 fill-current" />
      </button>
    </div>
  )
}
