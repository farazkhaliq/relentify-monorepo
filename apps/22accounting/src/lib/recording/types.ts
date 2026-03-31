export type RecordingState = 'idle' | 'recording' | 'reviewing' | 'uploading' | 'done' | 'error'

export interface RecordingChunk {
  blob: Blob
  index: number
}

export interface RecordingManager {
  /** Start recording. Resolves when recording begins. Rejects if permission denied. */
  start(options?: { audio?: boolean }): Promise<void>
  /** Stop recording. Returns all chunks. */
  stop(): Promise<Blob[]>
  /** Discard active recording without saving. */
  discard(): void
  /** Whether the browser/platform supports recording. */
  isSupported(): boolean
}
