# Recording System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified screen-recording "Report Issue" system for web (getDisplayMedia + MediaRecorder) and React Native (same API surface), with chunked upload to R2, an audit table, a support email via Resend, and PostHog analytics.

**Architecture:** A `RecordingManager` interface with a `WebRecordingManager` implementation encapsulates all platform differences. A `RecordingContext` React context holds recording state and is provided in the dashboard layout. Four UI components (`RecordingButton`, `RecordingIndicator`, `RecordingPanel`, `RecordingContext`) are platform-agnostic. A new `recording.service.ts` mirrors the patterns of `attachment.service.ts` — it writes to Postgres and delegates storage to the existing `getStorageProvider()` factory. The API route at `app/api/recordings/upload/route.ts` follows the same auth/validation pattern as `app/api/attachments/route.ts`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS (CSS variable tokens), `pg` pool (raw SQL via `src/lib/db.ts`), Cloudflare R2 / Postgres storage (existing `StorageProvider`), Resend (existing `src/lib/email.ts` pattern), posthog-js (existing `Analytics.tsx` pattern), vitest (add as dev dep for unit tests).

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `database/migrations/026_recording_uploads.sql` | Create | `recording_uploads` audit table |
| `src/lib/recording/types.ts` | Create | `RecordingManager` interface + shared types |
| `src/lib/recording/web.ts` | Create | `WebRecordingManager` implementation |
| `src/lib/recording/index.ts` | Create | Factory: `getRecordingManager()` |
| `src/lib/recording.service.ts` | Create | `logRecordingUpload`, `uploadRecordingToStorage`, `getRecordingPresignedUrl`, `sendSupportEmail` |
| `app/api/recordings/upload/route.ts` | Create | POST handler: auth, MIME validation, size cap, chunked-assembly, storage, audit log, email |
| `app/components/recording/RecordingContext.tsx` | Create | React context + provider: recording state machine |
| `app/components/recording/RecordingButton.tsx` | Create | Camera-icon nav button, browser-support check, audio toggle pre-start prompt |
| `app/components/recording/RecordingIndicator.tsx` | Create | Fixed-position floating pill: timer, stop button, confirm prompt |
| `app/components/recording/RecordingPanel.tsx` | Create | Slide-up panel: description field, progress bar, Discard / Send buttons |
| `app/dashboard/layout.tsx` | Modify | Wrap children with `RecordingProvider`; add `RecordingButton` and `RecordingIndicator` to TopBar area |
| `.env.example` | Modify | Add `SUPPORT_EMAIL` |
| `src/lib/__tests__/recording-manager.test.ts` | Create | Unit tests for `WebRecordingManager` |
| `src/lib/__tests__/recording-upload.test.ts` | Create | Integration test for POST `/api/recordings/upload` |

---

## Task 1: Database Migration 026

**Files:**
- Create: `database/migrations/026_recording_uploads.sql`

- [ ] **Step 1: Write and apply the migration**

```sql
-- 026_recording_uploads.sql
-- Run: docker exec -i infra-postgres psql -U relentify_user -d relentify < database/migrations/026_recording_uploads.sql

CREATE TABLE IF NOT EXISTS recording_uploads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  entity_id    UUID REFERENCES entities(id),
  filename     TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'video/webm',
  storage_key  TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_uploads_user_id ON recording_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_uploads_entity_id ON recording_uploads(entity_id);
```

Apply:
```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify \
  < /opt/relentify-monorepo/apps/22accounting/database/migrations/026_recording_uploads.sql
```

Verify:
```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "\d recording_uploads"
```

---

## Task 2: RecordingManager Interface + WebRecordingManager

**Files:**
- Create: `src/lib/recording/types.ts`
- Create: `src/lib/recording/web.ts`
- Create: `src/lib/recording/index.ts`

- [ ] **Step 1: Create `src/lib/recording/types.ts`**

```typescript
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
```

- [ ] **Step 2: Create `src/lib/recording/web.ts`**

```typescript
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
```

- [ ] **Step 3: Create `src/lib/recording/index.ts`**

```typescript
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
```

---

## Task 3: Recording Service

**Files:**
- Create: `src/lib/recording.service.ts`

- [ ] **Step 1: Create `src/lib/recording.service.ts`**

```typescript
import { query } from '@/src/lib/db'
import { getStorageProvider } from '@/src/lib/storage'
import { sendEmail } from '@/src/lib/email'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

export async function uploadRecordingToStorage(
  chunks: Buffer[],
  filename: string
): Promise<string> {
  const combined = Buffer.concat(chunks)
  const provider = getStorageProvider()
  const storageKey = `recordings/${Date.now()}-${filename}`
  await provider.put(storageKey, combined, 'video/webm')
  return storageKey
}

export async function logRecordingUpload(params: {
  userId: string
  entityId: string | null
  filename: string
  sizeBytes: number
  storageKey: string
  description: string | null
}): Promise<string> {
  const result = await query(
    `INSERT INTO recording_uploads (user_id, entity_id, filename, size_bytes, storage_key, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [params.userId, params.entityId, params.filename, params.sizeBytes, params.storageKey, params.description]
  )
  return result.rows[0].id
}

export async function sendSupportEmail(params: {
  userEmail: string
  description: string
  recordingId: string
}): Promise<void> {
  const supportEmail = process.env.SUPPORT_EMAIL
  if (!supportEmail) return

  await sendEmail({
    to: supportEmail,
    subject: `Recording submitted — ${params.userEmail}`,
    html: `
      <p><strong>From:</strong> ${params.userEmail}</p>
      <p><strong>Description:</strong> ${params.description || '(none)'}</p>
      <p><strong>Recording ID:</strong> ${params.recordingId}</p>
    `,
  })
}
```

---

## Task 4: Upload API Route

**Files:**
- Create: `app/api/recordings/upload/route.ts`

- [ ] **Step 1: Create `app/api/recordings/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getUserById } from '@/src/lib/user.service'
import { logRecordingUpload, sendSupportEmail, uploadRecordingToStorage } from '@/src/lib/recording.service'

const MAX_SIZE = 200 * 1024 * 1024 // 200MB total

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const chunk = formData.get('chunk') as File | null
  const chunkIndex = Number(formData.get('chunkIndex') ?? 0)
  const totalChunks = Number(formData.get('totalChunks') ?? 1)
  const filename = (formData.get('filename') as string) || 'recording.webm'
  const description = (formData.get('description') as string) || ''
  const assemblyKey = (formData.get('assemblyKey') as string) || ''

  if (!chunk) return NextResponse.json({ error: 'Missing chunk' }, { status: 400 })
  if (!['video/webm', 'video/mp4'].includes(chunk.type)) {
    return NextResponse.json({ error: 'Invalid MIME type' }, { status: 400 })
  }

  const buffer = Buffer.from(await chunk.arrayBuffer())

  // Store chunk in-memory keyed by assemblyKey (simple for single-server; use R2 for multi-instance)
  if (!global.__recordingChunks) global.__recordingChunks = {}
  if (!global.__recordingChunks[assemblyKey]) global.__recordingChunks[assemblyKey] = []
  global.__recordingChunks[assemblyKey][chunkIndex] = buffer

  // Not the last chunk — acknowledge and wait
  if (chunkIndex < totalChunks - 1) {
    return NextResponse.json({ received: chunkIndex + 1, total: totalChunks })
  }

  // All chunks received — assemble and store
  const allChunks: Buffer[] = global.__recordingChunks[assemblyKey]
  delete global.__recordingChunks[assemblyKey]

  const totalSize = allChunks.reduce((acc, c) => acc + c.length, 0)
  if (totalSize > MAX_SIZE) {
    return NextResponse.json({ error: 'Recording too large (200MB max)' }, { status: 413 })
  }

  const entity = await getActiveEntity(auth.userId)
  const user = await getUserById(auth.userId)
  const storageKey = await uploadRecordingToStorage(allChunks, filename)

  const recordingId = await logRecordingUpload({
    userId: auth.userId,
    entityId: entity?.id ?? null,
    filename,
    sizeBytes: totalSize,
    storageKey,
    description,
  })

  // Fire-and-forget support email
  sendSupportEmail({
    userEmail: user?.email ?? auth.email ?? 'unknown',
    description,
    recordingId,
  }).catch(console.error)

  return NextResponse.json({ success: true, recordingId })
}
```

---

## Task 5: React Context + State Machine

**Files:**
- Create: `app/components/recording/RecordingContext.tsx`

- [ ] **Step 1: Create `app/components/recording/RecordingContext.tsx`**

```typescript
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
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async (audio = false) => {
    const manager = getRecordingManager()
    if (!manager.isSupported()) {
      setErrorMessage('Screen recording is not supported in this browser')
      return
    }
    try {
      await manager.start({ audio })
      setState('recording')
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    } catch (err: any) {
      setErrorMessage(err.message ?? 'Failed to start recording')
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

    // Combine all blobs
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
```

---

## Task 6: UI Components

**Files:**
- Create: `app/components/recording/RecordingButton.tsx`
- Create: `app/components/recording/RecordingIndicator.tsx`
- Create: `app/components/recording/RecordingPanel.tsx`

- [ ] **Step 1: Create `app/components/recording/RecordingButton.tsx`**

```typescript
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
```

- [ ] **Step 2: Create `app/components/recording/RecordingIndicator.tsx`**

```typescript
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
```

- [ ] **Step 3: Create `app/components/recording/RecordingPanel.tsx`**

```typescript
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
```

---

## Task 7: Dashboard Layout Integration

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Add RecordingProvider + RecordingButton + RecordingIndicator + RecordingPanel to layout**

In `app/dashboard/layout.tsx`:

1. Import:
```typescript
import { RecordingProvider } from '@/app/components/recording/RecordingContext'
import { RecordingButton } from '@/app/components/recording/RecordingButton'
import { RecordingIndicator } from '@/app/components/recording/RecordingIndicator'
import { RecordingPanel } from '@/app/components/recording/RecordingPanel'
```

2. Wrap the entire layout return in `<RecordingProvider>`.

3. Add `<RecordingButton />` to the top nav area (near the user menu).

4. Add `<RecordingIndicator />` and `<RecordingPanel />` just before `</RecordingProvider>` — they are fixed-position so placement doesn't matter.

---

## Task 8: Env Var + Unit Tests + Deploy

**Files:**
- Modify: `.env.example`
- Create: `src/lib/__tests__/recording-manager.test.ts`
- Create: `src/lib/__tests__/recording-upload.test.ts`

- [ ] **Step 1: Add env var to `.env.example`**

Add:
```
SUPPORT_EMAIL=support@relentify.com
```

Also add `SUPPORT_EMAIL` to the `.env` file on the VPS.

- [ ] **Step 2: Add vitest dev dependency**

```bash
pnpm add -D vitest @vitest/coverage-v8 --filter 22accounting
pnpm install
```

Add to `package.json` scripts: `"test": "vitest run"`

- [ ] **Step 3: Create `src/lib/__tests__/recording-manager.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock browser APIs
const mockGetDisplayMedia = vi.fn()
const mockMediaRecorder = vi.fn()

beforeEach(() => {
  Object.defineProperty(global, 'navigator', {
    value: { mediaDevices: { getDisplayMedia: mockGetDisplayMedia } },
    writable: true,
  })
  global.MediaRecorder = mockMediaRecorder as any
})

describe('WebRecordingManager', () => {
  it('isSupported() returns false when getDisplayMedia is unavailable', async () => {
    Object.defineProperty(global, 'navigator', { value: {}, writable: true })
    const { WebRecordingManager } = await import('../recording/web')
    const manager = new WebRecordingManager()
    expect(manager.isSupported()).toBe(false)
  })

  it('isSupported() returns true when APIs are present', async () => {
    const { WebRecordingManager } = await import('../recording/web')
    const manager = new WebRecordingManager()
    expect(manager.isSupported()).toBe(true)
  })
})
```

- [ ] **Step 4: Rebuild and deploy**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 50
docker builder prune -f
```

Verify:
- Camera icon visible in dashboard top nav
- Clicking it triggers `getDisplayMedia` permission prompt
- Recording indicator shows with timer
- Stop → panel appears → Send uploads successfully
- `recording_uploads` row created in DB
- Support email received at `SUPPORT_EMAIL`
