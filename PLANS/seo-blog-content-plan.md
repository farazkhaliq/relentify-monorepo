# SEO Blog Content & Infrastructure Plan

## Context

Three websites need blog content to improve SEO: ascotknight.co.uk (letting agents), relentify.com (business SaaS), and kingfisherpharmacy.co.uk (NHS pharmacy). Each site needs 104 articles (2/week for 52 weeks = 312 total). This plan covers blog infrastructure builds, content themes, and the publishing pipeline.

---

## Cross-References

| Site | Source | CLAUDE.md |
|------|--------|-----------|
| ascotknight.co.uk | `/opt/ascotknight/ascot-knight-nextjs/` | `/opt/ascotknight/ascot-knight-nextjs/CLAUDE.md` |
| kingfisherpharmacy.co.uk | `/opt/kingfisher/` | `/opt/kingfisher/CLAUDE.md` |
| relentify.com (20marketing) | `/opt/relentify-monorepo/apps/20marketing/` | `/opt/relentify-monorepo/apps/20marketing/CLAUDE.md` |
| Global VPS config | — | `/root/.claude/CLAUDE.md` |

Each app's CLAUDE.md has a "Blog System" section with site-specific details (categories, writing rules, file paths). This plan has the overall strategy and progress tracker.

---

## Progress Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Ascot Knight blog infrastructure | **DONE** |
| 2 | Kingfisher blog infrastructure | **DONE** |
| 3 | Relentify blog infrastructure | **DONE** |
| 4 | Agree article titles & keywords (603 total) | **DONE** |
| 5 | Write all 603 articles as markdown + images | **DONE** |
| 6 | Go live — cron rebuilds + verification | **DONE** |

---

## What Was Built (Phases 1-3)

### Architecture (Identical Across All 3 Sites)

Each site uses the same markdown-based blog system:

- **Content storage:** `/content/blog/*.md` files with YAML frontmatter
- **Image storage:** `/public/blog/*.jpg` (Unsplash + AI-generated, stored locally)
- **Parsing:** `gray-matter` + `remark` + `remark-html` + `reading-time`
- **Routes:** `/blog` (index) + `/blog/[slug]` (individual posts)
- **SEO per post:** `generateMetadata()`, OpenGraph, Twitter Cards, JSON-LD BlogPosting schema, canonical URLs
- **Sitemap:** Dynamic `app/sitemap.ts` includes all published blog posts
- **Date-gating:** `publishDate <= today` checked at build time — future articles exist in repo but are invisible
- **Publishing:** Daily midnight cron rebuild makes newly-dated articles go live automatically

### Frontmatter Schema (All Sites)

```yaml
---
title: "Article Title"
slug: "article-slug"
publishDate: "2026-04-14"
author: "Author Name"
category: "Category Name"
excerpt: "1-2 sentence summary for cards and meta description."
image: "/blog/article-slug.jpg"
imageAlt: "Descriptive alt text"
tags: ["keyword1", "keyword2"]
---
```

### Per-Site Details

#### Ascot Knight (ascotknight.co.uk)

| Item | Detail |
|------|--------|
| Source | `/opt/ascotknight/ascot-knight-nextjs/` |
| Framework | Next.js 14, TypeScript, Tailwind 3 |
| Blog lib | `lib/blog.ts` |
| Content dir | `content/blog/` |
| Existing posts | 5 (migrated from hardcoded .tsx to markdown) |
| Blog index | `app/blog/page.tsx` — server component calling `getAllPosts()` |
| Post route | `app/blog/[slug]/page.tsx` — `generateStaticParams` + `generateMetadata` |
| Homepage | Refactored: server `app/page.tsx` → client `components/HomeContent.tsx` (passes blog data as props) |
| Sitemap | `app/sitemap.ts` — includes static pages + all blog posts |
| Commit | `73add26` — "[blog] Migrate Ascot Knight from hardcoded blog posts to markdown-based system" |

**Files created/modified:**
- `lib/blog.ts` (new)
- `components/HomeContent.tsx` (new — client wrapper for homepage)
- `app/blog/[slug]/page.tsx` (new — dynamic route)
- `app/blog/page.tsx` (rewritten — uses getAllPosts)
- `app/page.tsx` (rewritten — server component)
- `app/sitemap.ts` (rewritten — uses getAllPosts)
- `lib/constants.ts` (removed BLOG_POSTS array)
- `content/blog/*.md` (5 converted posts)
- `public/blog/*.jpg` (5 images downloaded from Unsplash)

**Files deleted:**
- `app/blog/middlesbrough-lettings-market-2025/page.tsx`
- `app/blog/compliance-rules-2025/page.tsx`
- `app/blog/letting-agent-fees-middlesbrough/page.tsx`
- `app/blog/renters-reform-act-middlesbrough-landlords/page.tsx`
- `app/blog/best-buy-to-let-postcodes-teesside-2026/page.tsx`
- `components/schema/BlogPosting.tsx`

#### Kingfisher Pharmacy (kingfisherpharmacy.co.uk)

| Item | Detail |
|------|--------|
| Source | `/opt/kingfisher/` |
| Framework | Next.js 14, TypeScript, Tailwind 3 |
| Blog lib | `lib/blog.ts` |
| Content dir | `content/blog/` |
| Existing posts | 3 (extracted from modal overlays in page.tsx) |
| Blog index | `app/blog/page.tsx` — card grid with category badges |
| Post route | `app/blog/[slug]/page.tsx` — green-themed, CTA to call pharmacy |
| Layout | `app/blog/layout.tsx` — breadcrumb nav (Home / Health Info) |
| Sitemap | `app/sitemap.ts` (new — didn't exist before) |
| robots.txt | `public/robots.txt` (new) |
| Commit | `45de6aa` — "[blog] Add markdown-based blog infrastructure to Kingfisher Pharmacy" |

**Files created:**
- `lib/blog.ts`
- `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/blog/layout.tsx`
- `app/sitemap.ts`
- `public/robots.txt`
- `content/blog/pharmacy-first-instead-of-gp.md`
- `content/blog/vaccinations-before-travelling-to-thailand.md`
- `content/blog/manage-repeat-prescriptions-online-wakefield.md`
- `public/blog/*.jpg` (3 images)

**Note:** The 3 modal article components (`ArticlePage`, `ArticleThailand`, `ArticleRepeatRx`) still exist in `app/page.tsx` for backward compatibility — they can be removed once the blog is confirmed working in production.

#### Relentify (relentify.com — 20marketing)

| Item | Detail |
|------|--------|
| Source | `/opt/relentify-monorepo/apps/20marketing/` |
| Framework | Next.js 15, TypeScript, Tailwind 4, pnpm monorepo |
| Blog lib | `app/lib/blog.ts` |
| Content dir | `content/blog/` |
| Existing posts | 1 sample (converted from hardcoded list) |
| Blog index | `app/blog/page.tsx` — server component → `BlogContent.tsx` client component (framer-motion animations) |
| Post route | `app/blog/[slug]/page.tsx` — **Next.js 15 async params** (`const { slug } = await params`) |
| Sitemap | `app/sitemap.ts` (new — covers all 13 product pages + blog posts) |
| Commit | `a2cbdb1` — "[blog] Add markdown-based blog infrastructure to Relentify marketing site" |

**Files created:**
- `app/lib/blog.ts`
- `app/blog/BlogContent.tsx` (client component with framer-motion)
- `app/blog/[slug]/page.tsx`
- `app/sitemap.ts`
- `content/blog/why-modern-businesses-are-leaving-xero.md`
- `public/blog/why-modern-businesses-are-leaving-xero.jpg`

**Files modified:**
- `app/blog/page.tsx` (rewritten from `'use client'` with hardcoded posts to server component)
- `package.json` (added gray-matter, remark, remark-html, reading-time)
- `pnpm-lock.yaml`

**Monorepo notes:**
- Dependencies added via `pnpm add --filter marketing`
- Dockerfile uses `turbo prune marketing --docker` — `content/` directory is included automatically
- Uses Relentify theme CSS variables (`var(--theme-accent)`, etc.) — no hardcoded colours

---

## Remaining Work

### Phase 4: Agree Article Titles & Keywords (312 Total)

Generate all 104 article titles + target SEO keywords per site. Present to user for review and approval before writing.

#### Ascot Knight — 6 Categories, 104 Articles

**Audience:** Landlords, property investors, buy-to-let investors in Teesside

| Category | ~Count | Focus |
|----------|--------|-------|
| Market Intelligence | 18 | Rental market updates, yield analysis, area performance |
| Landlord Advice | 20 | Practical tips on property management, maximising returns |
| Compliance & Regulation | 16 | Legal updates, EPC, Renters Reform Act, gas safety |
| Investment Guide | 18 | Buy-to-let strategy, postcode analysis, ROI calculations |
| Tenant Guides | 16 | Renting in Middlesbrough, rights, what to expect |
| Local Area Spotlights | 16 | Deep dives into Teesside areas |

**Writing rules:**
- Always mention Middlesbrough/Teesside for local SEO
- Use specific postcodes (TS1, TS5, TS7, etc.) where relevant
- Professional but approachable — premium brand voice (gold/navy design)
- 800–1,200 words per article
- Every article ends with CTA to contact Ascot Knight

#### Relentify — 6 Categories, 104 Articles

**Audience:** Small business owners, freelancers, letting agents, accountants

| Category | ~Count | Focus |
|----------|--------|-------|
| Small Business Guides | 20 | Invoicing, cash flow, tax, starting up |
| Accounting & Finance | 20 | MTD, VAT, bookkeeping, year-end |
| Product Insights | 16 | Feature deep-dives, how-to guides for Relentify |
| Industry Comparisons | 16 | vs Xero, vs QuickBooks, migration guides |
| Property & Lettings Tech | 16 | CRM, inventory tools for letting agents |
| Productivity & Growth | 16 | Scaling, hiring, time management |

**Writing rules:**
- Subtly position Relentify as the modern alternative (not salesy)
- UK-focused but globally applicable
- Technical but accessible — explain jargon
- 1,000–1,500 words per article
- Link to relevant Relentify product page where natural

#### Kingfisher Pharmacy — 5 Categories, 104 Articles

**Audience:** Wakefield residents, NHS patients, travellers

| Category | ~Count | Focus |
|----------|--------|-------|
| Pharmacy First | 20 | What conditions are covered, how the service works |
| Travel Health | 25 | Destination-specific vaccination guides (high SEO value) |
| Prescription Tips | 20 | Managing repeats, nominating pharmacy, NHS app |
| Seasonal Wellness | 20 | Hay fever, winter colds, flu season, sun safety |
| Pharmacy Services | 19 | Blood pressure checks, smoking cessation, NMS |

**Writing rules:**
- INFORMATIONAL ONLY — no medical advice, no dosage recommendations
- Always direct to "speak to your pharmacist" or "consult your GP" for personal decisions
- Always mention Wakefield for local SEO
- Friendly, helpful tone — like a knowledgeable neighbour
- 600–1,000 words per article
- Every article ends with CTA to visit/contact Kingfisher

### Phase 5: Write All 312 Articles

Once titles/keywords are approved:

1. Write all 104 `.md` files per site with correct `publishDate` values (every Monday + Thursday for 52 weeks)
2. Download/generate images for each article → `public/blog/`
3. Commit all content to each repo

**Schedule:** Start date TBD. Articles published 2/week (Monday + Thursday) for 52 weeks.

### Phase 6: Go Live

1. **Set up daily cron rebuilds** (staggered to avoid resource contention):
   ```
   0 0 * * * cd /opt/ascotknight/ascot-knight-nextjs && docker compose up -d --build >> /var/log/blog-rebuild.log 2>&1
   0 5 * * * cd /opt/kingfisher && docker compose up -d --build >> /var/log/blog-rebuild.log 2>&1
   0 10 * * * cd /opt/relentify-monorepo/apps/20marketing && docker compose up -d --build >> /var/log/blog-rebuild.log 2>&1
   ```
2. **Verify date-gating** — confirm future articles are hidden, past articles visible
3. **Monitor first week** — check logs, verify pages load, check sitemap updates

### Verification Checklist (Per Site)

- `curl -s https://[domain]/blog | grep -c "article"` — blog index shows posts
- `curl -s https://[domain]/blog/[slug]` — individual post renders
- `curl -s https://[domain]/sitemap.xml | grep blog` — sitemap includes posts
- OpenGraph tags render correctly (check via browser dev tools)
- JSON-LD BlogPosting schema present on each post
- Images load and are optimised via Next.js `<Image>`

---

## Images Strategy

- **Mix of Unsplash stock photos + AI-generated images**
- Stored locally in each site's `/public/blog/` directory
- Named to match article slug: `article-slug.jpg`
- Optimised to ~200KB (1200px wide, JPEG quality 80)
- Rendered via Next.js `<Image>` component for automatic optimisation
- Alt text specified in frontmatter `imageAlt` field
