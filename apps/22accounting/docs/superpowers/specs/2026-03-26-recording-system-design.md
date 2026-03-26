# Recording System — Customer Issue Recording

**Date:** 2026-03-26
**Scope:** 22accounting (web + React Native mobile) — one unified recording system
**Priority:** 5

---

## Objective

Non-technical customers can capture exactly what went wrong without needing to describe it in words. They hit a button, record their screen, add an optional note, and submit. An email arrives in the support inbox with the recording and full context. Works on both web and mobile (React Native) — same API, same email, one system.

---

## User Flow

1. User encounters a problem or confusion
2. Clicks **"Record Issue"** button in the app (persistent, accessible from any page)
3. Browser / app asks for screen sharing permission
4. User shares their screen (tab, window, or full screen — user's choice on web; device screen on mobile)
5. A floating recording indicator appears: `● Recording` with a stop button
6. User demonstrates the issue by navigating normally
7. Clicks **Stop Recording**
8. A confirmation prompt appears: **"Keep this recording?"** with [Discard] and [Continue] buttons — prevents accidental stops
9. If navigating away during recording: a browser beforeunload warning fires — "You have an active recording. Leave and discard it?"
10. On Continue: a small panel slides up with an optional description field and optional audio toggle
11. User clicks **Send to Support**
12. Recording uploads in the background with a visible progress percentage
13. Support inbox receives an email with: user name, company, page they were on, their description, and a link to the recording

---

## Technical Architecture

### Platform Strategy — One System

The recording system is one unified product. Web and mobile share the same upload endpoint, the same email format, and the same storage. Platform differences are encapsulated inside `RecordingManager`.

```ts
// RecordingManager is platform-aware
interface RecordingManager {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  isSupported(): boolean;
}

// Two implementations, one interface:
// WebRecordingManager  — getDisplayMedia + MediaRecorder
// NativeRecordingManager — react-native-screen-recorder (mobile phase)
```

The `RecordingButton`, `RecordingIndicator`, `RecordingPanel`, and `RecordingContext` components are platform-agnostic. They call `RecordingManager` and know nothing about `getDisplayMedia` or React Native APIs.

### Web Recording

**APIs used:**
- `navigator.mediaDevices.getDisplayMedia()` — screen capture (tab/window/screen)
- `MediaRecorder` — records the stream to `.webm` chunks

**Browser support:**
- Chrome, Edge, Firefox: full support
- Safari 17+: supported
- Safari < 17 / iOS (web): not supported — button shows "Screen recording requires Chrome, Edge, Firefox, or Safari 17+. On iPhone or iPad, use the Relentify mobile app." (disabled, not hidden)

**Implementation:**
```ts
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: 15, width: { ideal: 1280 } },
  audio: includeAudio,  // optional — user toggle in RecordingPanel pre-start prompt
});

const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
});

const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);

// Handle permission revoked mid-recording (e.g. user clicks "Stop Sharing" in browser chrome)
stream.getVideoTracks()[0].addEventListener('ended', () => {
  recorder.stop();  // triggers onstop handler as normal
  showToast('Screen sharing was stopped — your recording has been saved.');
});

recorder.onerror = (e) => {
  captureException(e);  // Sentry
  showToast('Recording failed. Please try again.');
};

recorder.start(1000); // collect chunks every 1 second
```

**Max duration:** 5 minutes. After 5 minutes, recording automatically stops and the panel opens.

**Audio:** Optional. Default off. A toggle in the pre-start prompt lets users enable microphone narration. Most users do not need audio; for those who want to explain verbally, it is available.

### React Native (Mobile)

The mobile implementation uses `react-native-screen-recorder`. It integrates into the same `RecordingManager` interface:
- File size limit: 50MB on mobile (vs 100MB on web) — accounts for cellular upload constraints
- Compression before upload: if the recorded file exceeds 20MB, it is compressed client-side before uploading (reduces time and data usage on cellular)
- Same upload endpoint, same email, same 30-day R2 retention

---

## UI Components

### `RecordingButton` (persistent in nav)

A small camera icon in the top navigation bar, to the left of the help `?` button. Label: "Report Issue". Always visible.

On click on supported browser: shows a small pre-start prompt with an audio toggle ("Include microphone audio?") then immediately requests screen share permission.

On unsupported browser: button is disabled (not hidden) with a tooltip explaining the requirement.

If permission denied: toast "Screen recording was blocked — please allow screen sharing and try again."

### `RecordingIndicator` (floating overlay)

A fixed-position pill at the bottom-right of the screen while recording is active:

```
● Recording  |  2:14  |  [Stop]
```

- Red pulsing dot
- Live timer
- Stop button — opens confirmation prompt before stopping (prevents accidental stop)

### Accidental Stop Prevention

When "Stop" is clicked, show an inline confirmation in the indicator before stopping:

```
Stop recording?   [Keep Recording]   [Stop & Review]
```

This prevents the common case where a user clicks Stop thinking it means something else.

### `RecordingPanel` (slide-up after confirmed stop)

Appears from the bottom after stop is confirmed:

```
[ What were you trying to do? (optional)              ]

[  0:34 recorded  |  Uploading ████████░░░░  67%  ]

                               [Discard]  [Send to Support]
```

- "Discard" shows a confirm dialog ("Are you sure? Your recording will be deleted.") then cancels the upload and dismisses the panel
- Upload progress shown as a percentage bar — upload begins immediately after stop, in parallel with user typing description
- On completion: "Sent — our team will review your recording shortly."
- On upload failure: toast "Upload failed" with a Retry button; failure logged to Sentry

---

## Upload & Storage

### Chunked Upload

Recordings are uploaded in 5MB chunks to handle network interruptions gracefully:
- If a chunk fails, that chunk is retried up to 3 times before showing the "Upload failed" toast
- Upload progress reflects actual bytes transferred (not just chunk count)
- On full upload failure, the recording blob is held in memory for the retry attempt

### API Endpoint

`POST /api/recordings/upload`

Accepts `multipart/form-data`:
- `recording`: `.webm` file (MIME type validated server-side — rejects anything that is not `video/webm`)
- `description`: optional string (sanitised: trimmed, max 2000 chars, HTML stripped)
- `pageUrl`: current URL (attached automatically by client)
- `userId`: from auth session (attached automatically)

Auth: standard JWT session. Unauthenticated users cannot submit recordings.

Server-side failure logging: every upload attempt (success or failure) is logged to a `recording_uploads` table with `userId`, `entityId`, `timestamp`, `fileSizeBytes`, `status`, `errorMessage`. Used by support to diagnose failed submissions.

### Storage

Recordings stored in **Cloudflare R2** (same storage backend as file attachments).

Key format: `recordings/{entityId}/{userId}/{timestamp}.webm`

**Retention:** 30 days. R2 lifecycle rule auto-deletes objects after 30 days.

**File size limit:** 100MB web / 50MB mobile (enforced at API level). In practice, 5-minute recordings at 15fps VP9 are typically 15–30MB.

### Presigned URL

The API response returns a presigned R2 URL (valid 7 days) that is embedded in the support email. Support staff can view the recording directly in the browser — no login required. Single-use is not enforced (support team may need to view multiple times), but the 7-day TTL limits exposure.

---

## Support Email

Sent via Resend (same email service used throughout 22accounting) to a configured support address (`SUPPORT_EMAIL` env var, e.g. `support@relentify.com`).

**Email format:**

```
Subject: Issue Recording — [User Name] at [Company Name]

User:     Sarah Johnson
Company:  Acme Ltd (entity_id: abc-123)
Plan:     small_business
Page:     /dashboard/invoices/new
Platform: Web (Chrome 124) / iOS 17.4 (React Native)
Duration: 0:34
Time:     26 March 2026, 14:32 GMT

Description:
"I was trying to add a new invoice but the VAT rate field disappeared."

Recording: [View Recording] (link expires 7 days)

---
Sent automatically from Relentify
```

---

## Analytics

Every recording submission sends a PostHog event (same instance as help analytics):

```ts
posthog.capture('issue_recording_submitted', {
  pageUrl,            // which page the issue was on
  durationSeconds,    // how long the recording is
  hasDescription,     // boolean — did they add a note?
  hasAudio,           // boolean — did they include mic audio?
  platform,           // 'web' | 'native'
});
```

No personal data. Used to identify high-friction pages and measure feature adoption.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/components/recording/RecordingManager.ts` | New: platform-aware interface + WebRecordingManager implementation |
| `src/components/recording/RecordingButton.tsx` | New: nav button, browser support check, audio toggle |
| `src/components/recording/RecordingIndicator.tsx` | New: floating timer + stop button + confirm prompt |
| `src/components/recording/RecordingPanel.tsx` | New: description + upload progress + discard/send |
| `src/components/recording/RecordingContext.tsx` | New: React context for recording state |
| `app/api/recordings/upload/route.ts` | New: chunked upload → R2 → presigned URL → email + audit log |
| `src/lib/recording.service.ts` | New: R2 upload, presigned URL, send support email |
| `database/migrations/027_recording_uploads.sql` | New: `recording_uploads` audit table |
| `app/dashboard/layout.tsx` | Add `RecordingButton` to nav |
| `.env.example` | Add `SUPPORT_EMAIL` variable |
