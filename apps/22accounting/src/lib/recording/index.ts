import type { RecordingManager } from './types'

let instance: RecordingManager | null = null

export function getRecordingManager(): RecordingManager {
  if (!instance) {
    // Dynamic import keeps MediaRecorder out of SSR bundle
    const { WebRecordingManager } = require('./web')
    instance = new WebRecordingManager()
  }
  return instance
}

export type { RecordingManager } from './types'
