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

- [ ] **Step 1: Write the migration file**
