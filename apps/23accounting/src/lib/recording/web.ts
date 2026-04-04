'use client'

import type { RecordingManager } from './types'

export class WebRecordingManager implements RecordingManager {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    )
  }

  async start(options?: { audio?: boolean }): Promise<void> {
    if (!this.isSupported()) throw new Error('Screen recording not supported in this browser')

    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: options?.audio ?? false,
    })

    this.chunks = []
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    this.mediaRecorder.start(1000) // 1s timeslices

    // Auto-stop if user stops sharing via browser UI
    this.stream.getVideoTracks()[0].onended = () => {
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.stop()
      }
    }
  }

  async stop(): Promise<Blob[]> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve([])

      this.mediaRecorder.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop())
        resolve(this.chunks)
      }
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop()
      } else {
        resolve(this.chunks)
      }
    })
  }

  discard(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.mediaRecorder = null
    this.stream = null
    this.chunks = []
  }
}
