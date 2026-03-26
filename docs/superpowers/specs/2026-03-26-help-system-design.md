# Help System — help.relentify.com + In-App

**Date:** 2026-03-26
**Scope:** New monorepo app `apps/26help` + in-app help integration across 22accounting
**Priority:** 3

---

## Objective

A complete help centre that requires zero ongoing involvement from the product owner. Articles are written once in MDX, videos are generated automatically via Playwright, and the system scales to hundreds of articles without structural changes.

---

## Architecture

### New App: `apps/26help`

A standalone Next.js application deployed to `help.relentify.com`. It lives in the monorepo alongside other apps, has its own Dockerfile and Caddy block, and shares no routes with `apps/20marketing`.

```
apps/26help/
  content/                   ← all article content (MDX files)
    accounting/
      create-invoice.mdx
      record-payment.mdx
      bank-reconciliation.mdx
      ...
    crm/
    reminders/
    migration/
    api/                     ← developer API docs
    fields/                  ← field-level tooltip content (see §Tooltips)
      due-date.md
      vat-rate.md
      ...
  public/
    videos/                  ← Playwright-generated video files (.webm)
    posters/                 ← poster frames for VideoGuide LQIP
  src/
    app/
      layout.tsx
      page.tsx               ← home: search + category cards
      [category]/
        page.tsx             ← category listing
        [article]/
          page.tsx           ← article page
    components/
      ArticleLayout.tsx      ← article wrapper (breadcrumb, title, toc, video)
      VideoGuide.tsx         ← embedded video player (lazy, accessible)
      HelpSearch.tsx         ← Pagefind-powered search UI
      CategoryCard.tsx
    lib/
      content.ts             ← MDX loader + Zod validation + help map generation
      analytics.ts           ← article view tracking
  playwright/
    scripts/                 ← one .ts file per video guide
    record.ts                ← runner: logs in, runs script, saves .webm
    validate.ts              ← CI runner: dry-runs all scripts, fails if elements missing
  next.config.js
  Dockerfile
  docker-compose.yml
  package.json
```

### Deployment

- Container: `26help`, port 3026
- Caddy block: `help.relentify.com → 26help:3026`
- Network: `infra_default`

---

## Content System (MDX)

### Article Format

Every article is a `.mdx` file with frontmatter:

```mdx
---
title: How to Create an Invoice
description: Send professional invoices to your customers in seconds.
category: accounting
order: 1
video: create-invoice.webm
videoDuration: 45          ← seconds — build warns if >90
videoSize: 2.4             ← MB — build warns if >10
relatedArticles:
  - record-payment
  - manage-customers
---

## What this does
...

## When to use it
...

## Step by step
1. Go to **Invoices** in the left menu
...

<VideoGuide src="create-invoice.webm" poster="create-invoice.jpg" duration={45} />

## Related guides
- [Recording a payment](/accounting/record-payment)
```

### Frontmatter Schema (Zod — enforced at build time)

```ts
// lib/content.ts
import { z } from 'zod';

const ArticleSchema = z.object({
  title:            z.string().min(5),
  description:      z.string().min(10),
  category:         z.enum(['accounting', 'crm', 'reminders', 'migration', 'api']),
  order:            z.number().int().positive(),
  video:            z.string().endsWith('.webm').optional(),
  videoDuration:    z.number().max(90).optional(),   // warn if missing when video present
  videoSize:        z.number().max(10).optional(),   // warn if >10MB
  relatedArticles:  z.array(z.string()).optional(),
});
```

Build fails if any `.mdx` file fails schema validation. This prevents missing `category` fields, typos in video filenames, or incorrectly structured content from reaching production silently.

### Content Conventions

- Plain English throughout — no accounting jargon without explanation
- Every article follows the same four sections: What this does / When to use it / Step by step / Related guides
- Steps are numbered, imperative, and specific to the actual UI labels
- No screenshots — videos replace them
- **Video length:** 30–60 seconds for simple tasks, 60–90 seconds for multi-step flows. Nothing longer.

### Auto-Generated Table of Contents

`ArticleLayout.tsx` extracts all `## headings` from the MDX at render time and renders a sticky TOC sidebar on desktop. No manual maintenance — adding a heading to an article automatically updates the TOC.

---

## Search (Pagefind)

Pagefind runs at build time, indexing all MDX content. No external service, no API key, no cost.

**Scale note:** Pagefind handles up to ~500 articles comfortably. Above that, split the index by category (Pagefind supports multiple sub-indexes). This is a future concern — not needed at launch. The implementation uses category-namespaced data attributes (`data-pagefind-section="accounting"`) from the start, so splitting is non-breaking when needed.

---

## Video Guides (Playwright)

### Approach

Each feature has a Playwright script in `playwright/scripts/`. The runner logs in as a test user, executes the script, records via Playwright's `recordVideo` option, then post-processes with `ffmpeg`.

### ffmpeg Compression

All recorded videos are compressed before saving to `public/videos/`:

```bash
ffmpeg -i raw.webm \
  -c:v libvpx-vp9 \
  -crf 28 \
  -preset veryfast \
  -b:v 0 \
  -vf "scale=1280:-1" \
  output.webm
```

A poster frame (JPEG thumbnail from first non-blank frame) is extracted simultaneously:

```bash
ffmpeg -i output.webm -vframes 1 -ss 0.5 public/posters/{name}.jpg
```

### Captions / Subtitles

Videos are silent but must have captions for accessibility. Each video has a corresponding `.vtt` file generated from the article's Step-by-step section using a simple text-to-timecode mapper (no AI/Whisper needed — the steps are already timed to the recording script):

```
WEBVTT

00:00.000 --> 00:04.000
Go to Invoices in the left menu

00:04.000 --> 00:08.000
Click New Invoice
...
```

The `<VideoGuide>` component loads the `.vtt` as a `<track kind="captions">` element.

### Video Validation (CI)

`playwright/validate.ts` is a dry-run that executes every recording script against the staging app **without** actually recording. It verifies:
- Login succeeds
- Every expected UI element (button label, page heading, form field) is locatable
- Navigation succeeds to expected URLs

**Runs in CI on every push.** Fails the build if any script cannot locate an expected element. This means a UI label change surfaces as a CI failure in the PR that caused it — not as a silent broken video weeks later.

```bash
# CI command
npx ts-node playwright/validate.ts --all
```

### Recording Runner

```ts
// playwright/record.ts
// Usage: npx ts-node record.ts create-invoice
// Outputs: public/videos/create-invoice.webm + public/posters/create-invoice.jpg + captions/create-invoice.vtt
```

### Launch Video List (minimum 20)

| Script | Article |
|--------|---------|
| `create-invoice` | Creating an invoice |
| `record-invoice-payment` | Recording invoice payment |
| `send-invoice` | Sending an invoice to a customer |
| `create-quote` | Creating a quote |
| `convert-quote` | Converting a quote to invoice |
| `create-bill` | Creating a bill |
| `record-bill-payment` | Paying a bill |
| `bank-reconciliation` | Reconciling bank transactions |
| `add-customer` | Adding a customer |
| `add-supplier` | Adding a supplier |
| `create-expense` | Submitting an expense |
| `approve-expense` | Approving an expense |
| `create-credit-note` | Issuing a credit note |
| `pl-report` | Reading a P&L report |
| `balance-sheet` | Reading a balance sheet |
| `trial-balance` | Running a trial balance |
| `vat-return` | Calculating a VAT return |
| `import-opening-balances` | Importing opening balances |
| `invite-team-member` | Inviting a team member |
| `create-journal` | Creating a manual journal |

---

## `VideoGuide` Component

Requirements:
- **Lazy-loaded** — only initialises when scrolled into viewport (`IntersectionObserver`)
- **Poster frame** shown before play (prevents blank loading state)
- **Captions** loaded via `<track>` — visible by default
- **Controls:** play/pause, scrub, fullscreen, caption toggle — no autoplay
- **Keyboard accessible:** space to play/pause, arrow keys to scrub 5s

```tsx
<VideoGuide
  src="/videos/create-invoice.webm"
  poster="/posters/create-invoice.jpg"
  captions="/captions/create-invoice.vtt"
  duration={45}
/>
```

---

## URL Structure

```
help.relentify.com/                          ← home: search + category cards
help.relentify.com/accounting/               ← all accounting articles
help.relentify.com/accounting/create-invoice ← article
help.relentify.com/crm/
help.relentify.com/api/                      ← Developer API docs
```

All URLs are statically generated (Next.js SSG) at build time.

---

## In-App Integration (22accounting)

### Help Button

A `?` icon in the top navigation bar (right side, near UserMenu). Opens the relevant help article in a new tab.

### Auto-Generated URL Map

The `helpUrlMap` is **generated from content metadata**, not maintained manually. `content.ts` exports a `generateHelpMap()` function that reads all MDX frontmatter and builds the route → article URL mapping based on a `routePath` field in the frontmatter:

```mdx
---
title: How to Create an Invoice
routePath: /dashboard/invoices/new    ← maps this app route to this article
...
---
```

```ts
// Generated automatically — never hand-edited
export const helpUrlMap = generateHelpMap(content);
// { '/dashboard/invoices/new': '/accounting/create-invoice', ... }
```

Adding a new article with a `routePath` automatically updates the mapping on next build. No developer action required.

### Contextual Tooltips

Field-level tooltips use a `helpKey` prop that resolves to content from the `content/fields/` directory:

```tsx
<FormField helpKey="due-date" label="Due Date" />
```

`content/fields/due-date.md` contains:
```
The date by which your customer must pay. Invoices overdue past this date are highlighted in red.
```

The tooltip text is loaded at build time from the MDX field files. Adding a new tooltip field requires only a new `.md` file — no component changes. Keyboard accessible: `tabindex="0"`, `role="tooltip"`, `aria-label`.

---

## SEO

- All article pages: Next.js SSG
- `<title>`: `{article.title} — Relentify Help`
- `<meta description>`: from frontmatter `description`
- `<link rel="canonical">`: `help.relentify.com/{category}/{slug}`
- `sitemap.xml` auto-generated from content directory at build time
- Open Graph tags on all pages

---

## Analytics

Every article page view sends a minimal event to PostHog (same instance used by 22accounting):

```ts
posthog.capture('help_article_viewed', {
  article: slug,
  category,
  referrer: document.referrer,  // 'app' if coming from in-app help button
});
```

This surfaces: which articles are read most, which features users need help with, and whether in-app links are being used. No personal data — slug + category only.

---

## CI/CD Pipeline

On every push to `main`:

```
1. pnpm build (packages + apps/26help)
   └── content.ts: Zod schema validation on all MDX files → fail if invalid
   └── Pagefind: index all content
   └── Next.js: SSG all article pages

2. playwright/validate.ts --all (staging)
   └── Dry-run all recording scripts against staging app
   └── Fail build if any UI element not found

3. Docker build + push (26help image)

4. On staging pass: deploy to help.relentify.com
```

Regenerating videos is a separate manual step (run `record.ts` for affected scripts). Adding a new article only requires:
1. Commit `.mdx` file
2. Optionally commit new Playwright script
3. Push → automated build → deployed

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/26help/` | Entire new app |
| `apps/26help/content/accounting/*.mdx` | 20+ accounting articles (with `routePath` frontmatter) |
| `apps/26help/content/fields/*.md` | Field-level tooltip content |
| `apps/26help/src/lib/content.ts` | MDX loader + Zod validation + `generateHelpMap()` |
| `apps/26help/src/lib/analytics.ts` | PostHog article view tracking |
| `apps/26help/src/components/VideoGuide.tsx` | Lazy video player, captions, keyboard accessible |
| `apps/26help/src/components/HelpSearch.tsx` | Pagefind search UI |
| `apps/26help/playwright/scripts/*.ts` | One per video guide |
| `apps/26help/playwright/record.ts` | Recording + ffmpeg compression + poster + captions |
| `apps/26help/playwright/validate.ts` | CI dry-run validator |
| `apps/26help/Dockerfile` | Container |
| `apps/26help/docker-compose.yml` | Compose config |
| `/opt/infra/caddy/Caddyfile` | Add `help.relentify.com` block |
| `apps/22accounting/src/components/layout/HelpButton.tsx` | `?` nav button (uses generated map) |
