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
  public/
    videos/                  ← Playwright-generated video files (.webm)
  src/
    app/
      layout.tsx             ← help site layout (separate from marketing)
      page.tsx               ← home: search + category cards
      [category]/
        page.tsx             ← category listing
        [article]/
          page.tsx           ← article page
    components/
      ArticleLayout.tsx      ← article wrapper (breadcrumb, title, toc, video)
      VideoGuide.tsx         ← embedded video player component
      HelpSearch.tsx         ← Pagefind-powered search UI
      CategoryCard.tsx       ← home page category cards
    lib/
      content.ts             ← MDX loader + metadata extraction
  playwright/
    scripts/                 ← one .ts file per video guide
      create-invoice.ts
      record-payment.ts
      bank-reconciliation.ts
      ...
    record.ts                ← runner: launches app, records screen, saves to public/videos/
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
relatedArticles:
  - record-payment
  - manage-customers
---

## What this does

Creating an invoice records a sale and sends a payment request to your customer.
Relentify automatically tracks what's owed and updates your financial reports.

## When to use it

Use this whenever you've completed work or delivered goods and need to request payment.

## Step by step

1. Go to **Invoices** in the left menu
2. Click **New Invoice**
3. Select or type your customer name
4. Add line items — description, quantity, unit price
5. Set the due date
6. Click **Send** to email the invoice directly, or **Save** to send later

<VideoGuide src="create-invoice.webm" />

## Related guides

- [Recording a payment](/accounting/record-payment)
- [Managing customers](/accounting/manage-customers)
```

### Content Conventions

- Plain English throughout — no accounting jargon without explanation
- Every article follows the same four sections: What this does / When to use it / Step by step / Related guides
- Steps are numbered, imperative, and specific to the actual UI labels
- No screenshots — videos replace them

---

## Search (Pagefind)

Pagefind runs at build time, indexing all MDX content. No external service, no API key, no cost. The search UI (`HelpSearch.tsx`) loads the Pagefind bundle client-side and renders results inline. Fully offline-capable.

---

## Video Guides (Playwright)

### Approach

Each feature has a corresponding Playwright script in `playwright/scripts/`. The runner (`playwright/record.ts`) launches a Chromium instance against the live 22accounting app at `http://localhost:3022`, runs the script, captures the screen using `ffmpeg` piped from Chromium's `--use-fake-ui-for-media-stream`, and saves the output as `.webm` to `public/videos/`.

Videos do not include audio. They are short (30–90 seconds), task-focused, and follow the exact steps described in the article.

### Recording Runner

```ts
// playwright/record.ts
// Usage: npx ts-node record.ts create-invoice
// Outputs: public/videos/create-invoice.webm
```

The runner:
1. Logs in as a test user (credentials from env)
2. Runs the named script
3. Records screen via Playwright's `recordVideo` option
4. Saves and compresses the output

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

## URL Structure

```
help.relentify.com/                          ← home: search + categories
help.relentify.com/accounting/               ← all accounting articles
help.relentify.com/accounting/create-invoice ← article
help.relentify.com/crm/                      ← CRM category
help.relentify.com/api/                      ← Developer API docs
```

All URLs are statically generated at build time. Changing an article requires updating the MDX file and rebuilding the container.

---

## In-App Integration (22accounting)

### Help Button

A `?` icon in the top navigation bar (right side, near UserMenu). Clicking it does not open a modal — it opens the relevant help article in a new tab at `help.relentify.com`.

### URL Mapping

A `helpUrlMap` in 22accounting maps current route paths to help article URLs:

```ts
export const helpUrlMap: Record<string, string> = {
  '/dashboard/invoices/new':     '/accounting/create-invoice',
  '/dashboard/invoices':         '/accounting/manage-invoices',
  '/dashboard/bills/new':        '/accounting/create-bill',
  '/dashboard/banking':          '/accounting/bank-reconciliation',
  '/dashboard/reports/pl':       '/accounting/pl-report',
  // ...
};
```

If the current route is not in the map, the button links to `help.relentify.com/` (home).

### Contextual Tooltips

Key form fields get a small `ⓘ` icon that, on hover, shows a one-sentence tooltip explaining the field. These are not linked to the help site — they are short inline explanations only. Examples:
- Due date field: "The date by which your customer must pay."
- VAT rate: "The VAT rate applied to this line item. Use 20% for standard-rated goods."
- Account code: "The chart of accounts category this expense belongs to."

---

## SEO

- All article pages are server-rendered (Next.js SSG)
- `<title>`: `{article.title} — Relentify Help`
- `<meta description>`: from frontmatter `description`
- `<link rel="canonical">`: always points to `help.relentify.com/{category}/{slug}`
- `sitemap.xml` auto-generated from content directory at build time
- Open Graph tags on all pages

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/26help/` | Entire new app |
| `apps/26help/content/accounting/*.mdx` | 20+ accounting articles |
| `apps/26help/src/components/VideoGuide.tsx` | Video player |
| `apps/26help/src/components/HelpSearch.tsx` | Pagefind search |
| `apps/26help/playwright/scripts/*.ts` | One per video guide |
| `apps/26help/playwright/record.ts` | Recording runner |
| `apps/26help/Dockerfile` | Container |
| `apps/26help/docker-compose.yml` | Compose config |
| `/opt/infra/caddy/Caddyfile` | Add `help.relentify.com` block |
| `apps/22accounting/src/lib/help-urls.ts` | Route → article URL map |
| `apps/22accounting/src/components/layout/HelpButton.tsx` | `?` nav button |
