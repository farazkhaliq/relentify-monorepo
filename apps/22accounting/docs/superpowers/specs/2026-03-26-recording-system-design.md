# Recording System — Customer Issue Recording

**Date:** 2026-03-26
**Scope:** 22accounting (web) — "Record Issue" button + upload + email notification
**Priority:** 5

---

## Objective

Non-technical customers can capture exactly what went wrong without needing to describe it in words. They hit a button, record their screen, add an optional note, and submit. An email arrives in the support inbox with the recording and full context.

---

## User Flow

1. User encounters a problem or confusion
2. Clicks **"Record Issue"** button in the app (persistent, accessible from any page)
3. Browser asks for screen sharing permission
4. User shares their screen (tab, window, or full screen — user's choice)
5. A floating recording indicator appears: `● Recording` with a stop button
6. User demonstrates the issue by navigating normally
7. Clicks **Stop Recording**
8. A small panel slides up: optional description field (placeholder: "What were you trying to do?")
9. User clicks **Send to Support**
10. Recording uploads in the background, confirmation shown
11. Support inbox receives an email with: user name, company, page they were on, their description, and a link to the recording

---

## Technical Architecture

### Web Recording (Primary)

**APIs used:**
- `navigator.mediaDevices.getDisplayMedia()` — screen capture (tab/window/screen)
- `MediaRecorder` — records the stream to `.webm` chunks

**Implementation:**
```ts
// RecordingManager.ts
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: 15, width: { ideal: 1280 } },
  audio: false,
});

const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
});

const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  upload(blob);
};

recorder.start(1000); // collect chunks every 1 second
```

**Frame rate:** 15fps — sufficient for UI walkthroughs, keeps file size small (typically 2–8MB for a 60-second recording).

**Max duration:** 5 minutes. After 5 minutes, recording automatically stops and prompts to submit.

**Browser support:** Chrome, Edge, Firefox, Safari 17+. For unsupported browsers, the button shows: "Screen recording requires Chrome, Edge, or Firefox."

### React Native (Mobile — future)

Mobile recording is architecturally scoped but not built in this phase. The `RecordingButton` component accepts a `platform` prop. On web it uses `getDisplayMedia`. On React Native it will use `react-native-screen-recorder` (to be integrated when mobile app exists). The API endpoint and email logic are shared.

---

## UI Components

### `RecordingButton` (persistent in nav)

A small camera icon in the top navigation bar, to the left of the help `?` button. Label: "Report Issue". Always visible.

On click: immediately requests screen share permission. If denied: shows a toast "Screen recording was blocked — please allow screen sharing and try again."

### `RecordingIndicator` (floating overlay)

A fixed-position pill at the bottom-right of the screen while recording is active:

```
● Recording  |  0:34  |  [Stop]
```

- Red pulsing dot
- Live timer
- Stop button ends recording and opens the description panel

### `RecordingPanel` (slide-up after stop)

Appears from the bottom after stop is clicked:

```
[ What were you trying to do? (optional)              ]
                               [Cancel]  [Send to Support]
```

"Send to Support" triggers upload. Panel shows upload progress. On completion: "Sent — our team will review your recording shortly."

---

## Upload & Storage

### API Endpoint

`POST /api/recordings/upload`

Accepts `multipart/form-data`:
- `recording`: `.webm` file
- `description`: optional string
- `pageUrl`: current URL (attached automatically by client)
- `userId`: from auth session (attached automatically)

Auth: standard JWT session. Unauthenticated users cannot submit recordings (they would not be logged in to access the app).

### Storage

Recordings stored in **Cloudflare R2** (same storage backend as file attachments).

Key format: `recordings/{entityId}/{userId}/{timestamp}.webm`

**Retention:** 30 days. R2 lifecycle rule auto-deletes objects after 30 days. No manual cleanup needed.

**File size limit:** 100MB (enforced at API level). In practice, 5-minute recordings at 15fps VP9 are typically 15–30MB.

### Presigned URL

The API response returns a presigned R2 URL (valid 7 days) that is embedded in the support email. Support staff can view the recording directly in the browser — no login required.

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
Time:     26 March 2026, 14:32 GMT

Description:
"I was trying to add a new invoice but the VAT rate field disappeared."

Recording: [View Recording] (link expires 7 days)

---
Sent automatically from Relentify
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/components/recording/RecordingManager.ts` | New: MediaRecorder wrapper, stream handling |
| `src/components/recording/RecordingButton.tsx` | New: nav button, triggers recording start |
| `src/components/recording/RecordingIndicator.tsx` | New: floating timer + stop button |
| `src/components/recording/RecordingPanel.tsx` | New: post-stop description + submit panel |
| `src/components/recording/RecordingContext.tsx` | New: React context for recording state |
| `app/api/recordings/upload/route.ts` | New: multipart upload → R2 → email |
| `src/lib/recording.service.ts` | New: R2 upload, presigned URL, send support email |
| `app/dashboard/layout.tsx` | Add `RecordingButton` to nav |
| `.env.example` | Add `SUPPORT_EMAIL` variable |
