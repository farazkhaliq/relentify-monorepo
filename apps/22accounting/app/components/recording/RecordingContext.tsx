'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { getRecordingManager } from '@/src/lib/recording'

type RecordingState = 'idle' | 'recording' | 'reviewing' | 'uploading' | 'done' | 'error'

interface RecordingContextValue {
  state: RecordingState
  elapsedSeconds: number
  uploadProgress: number
  errorMessage: string | null
  startRecording: (audio?: boolean) => Promise<void>
  stopRecording: () => Promise<void>
  discardRecording: () => void
  sendRecording: (description: string) => Promise<void>
}

const RecordingContext = createContext<RecordingContextValue | null>(null)

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecordingState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async (audio = false) => {
    const manager = getRecordingManager()
    if (!manager.isSupported()) {
      setErrorMessage('Screen recording is not supported in this browser')
      setState('error')
      return
    }
    try {
      await manager.start({ audio })
      setState('recording')
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start recording'
      setErrorMessage(message)
      setState('error')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const manager = getRecordingManager()
    const blobs = await manager.stop()
    chunksRef.current = blobs
    setState('reviewing')
  }, [])

  const discardRecording = useCallback(() => {
    getRecordingManager().discard()
    chunksRef.current = []
    setState('idle')
    setElapsedSeconds(0)
    setErrorMessage(null)
  }, [])

  const sendRecording = useCallback(async (description: string) => {
    setState('uploading')
    setUploadProgress(0)
    const assemblyKey = crypto.randomUUID()
    const CHUNK_SIZE = 5 * 1024 * 1024

    const combined = new Blob(chunksRef.current, { type: 'video/webm' })
    const totalChunks = Math.ceil(combined.size / CHUNK_SIZE)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, combined.size)
      const chunkBlob = combined.slice(start, end)

      const formData = new FormData()
      formData.append('chunk', chunkBlob, 'chunk.webm')
      formData.append('chunkIndex', String(i))
      formData.append('totalChunks', String(totalChunks))
      formData.append('filename', 'recording.webm')
      formData.append('description', description)
      formData.append('assemblyKey', assemblyKey)

      await fetch('/api/recordings/upload', { method: 'POST', body: formData })
      setUploadProgress(Math.round(((i + 1) / totalChunks) * 100))
    }

    chunksRef.current = []
    setState('done')
  }, [])

  // Warn before tab close during active recording
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state === 'recording') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state])

  return (
    <RecordingContext.Provider
      value={{ state, elapsedSeconds, uploadProgress, errorMessage, startRecording, stopRecording, discardRecording, sendRecording }}
    >
      {children}
    </RecordingContext.Provider>
  )
}

export function useRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext)
  if (!ctx) throw new Error('useRecording must be used inside RecordingProvider')
  return ctx
}
