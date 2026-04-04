# 20marketing — Marketing Website (relentify.com)

**Container**: `20marketing` | **Port**: 3020 → 3000 | **Runtime**: Next.js 15 App Router | **Database**: None

Marketing site at `relentify.com`. Migrated from Vite to Next.js 15 on 2026-04-03.

---

## Tech Stack

- **Framework**: Next.js 15.3 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4.2 with CSS variables (theme system)
- **Animations**: GSAP 3.14, Framer Motion 11.18
- **Icons**: Lucide React 0.400
- **Build**: Multi-stage Docker (turbo prune → pnpm → Next.js standalone)

---

## Deployment

```bash
cd /opt/relentify-monorepo/apps/20marketing
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs relentify-com --tail 50
```

Health check: `wget -q --spider http://127.0.0.1:3000/` every 30s.

---

## All Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Page | Hero + LiquidityMonitor + feature overview |
| `/accounting` | Page | Pricing tiers + feature comparison |
| `/inventory` | Page | Property Inventories product page |
| `/crm` | Page | CRM product page |
| `/reminders` | Page | Reminders product page |
| `/timesheets` | Page | Timesheets product page |
| `/esign` | Page | E-Sign product page |
| `/websites` | Page | Websites product page |
| `/payroll` | Page | Payroll & HR product page |
| `/blog` | Server → Client | Blog index (server reads markdown, client renders with framer-motion) |
| `/blog/[slug]` | Server | Individual blog post with SEO |
| `/privacy` | Page | Privacy policy |
| `/alternatives` | Page | Competitor comparison hub |
| `/xero-alternative` | Page | Xero competitor positioning |
| `/xero-v-relentify` | Page | Xero vs Relentify comparison |
| `/quickbooks-alternative` | Page | QuickBooks competitor positioning |
| `/quickbooks-v-relentify` | Page | QuickBooks vs Relentify comparison |
| `/chat` | Page | Chat product landing — features, Tawk.to comparison, pricing, embed snippet |
| `/chat/demo` | Page | Interactive widget demo — live widget.js embed, agent view mockup |
| `/connect` | Page | Connect product landing — channels, Intercom/Zendesk comparisons, savings calculator, pricing |
| `/pricing` | Page | All plans — Chat/Connect toggle, feature matrix, FAQ |
| `/sitemap.xml` | Generated | Dynamic sitemap (all pages + blog posts) |

**Total**: 21 routes + sitemap

---

## Theme System

4 presets defined in `src/app/themes.ts`:

| Preset | Identity | Primary | Accent | Heading Font |
|--------|----------|---------|--------|-------------|
| A | Professional | Slate 900 | Blue 500 | Sans Bold |
| B | Modern | Black | Emerald 500 | Sans Bold |
| C | Utility | Gray 900 | Red 500 | Space Grotesk Bold |
| D | Premium | Slate 950 | Amber 500 | Playfair Italic |

CSS variables injected at runtime: `--theme-primary`, `--theme-accent`, `--theme-background`, `--theme-text`, `--theme-card`, `--theme-border`, etc.

**Dark mode**: Toggles `.dark` class on `<html>`, overrides CSS variables.

**Color rule**: Always use `bg-[var(--theme-*)]` / `text-[var(--theme-*)]`. Never hardcode hex/rgb or Tailwind colour classes.

---

## Region System

6 regions: UK, USA, Canada, Australia, New Zealand, EU.

| Region | Currency | Price Multiplier (GBP base) |
|--------|----------|----------------------------|
| UK | £ | 1x |
| USA | $ | 1.5x |
| Canada | $ | 2x |
| Australia | $ | 2x |
| New Zealand | $ | 3x |
| EU | € | 1.5x |

- Storage: `localStorage.relentify-region` + cookie `relentify_theme` (`.relentify.com` domain)
- Auto-detection on first visit via `ipapi.co/json/`

---

## Context Providers (App.tsx)

1. **ThemeContext** — `preset`, `setPreset`, `theme`, `isDarkMode`, `toggleDarkMode()`
2. **RegionContext** — `region`, `setRegion()`
3. **Router** — React Router with ScrollToTop on route change

---

## Blog System (Added 2026-04-03)

Markdown-based blog with date-gated static generation.

| Item | Detail |
|------|--------|
| Blog lib | `app/lib/blog.ts` — getAllPosts, getPostBySlug, getAllSlugs |
| Content dir | `content/blog/*.md` |
| Image dir | `public/blog/*.jpg` |
| Parsing | gray-matter + remark + remark-html + reading-time |
| Blog index | `app/blog/page.tsx` (server) → `app/blog/BlogContent.tsx` (client, framer-motion) |
| Post route | `app/blog/[slug]/page.tsx` — **Next.js 15 async params** (`const { slug } = await params`) |
| Sitemap | `app/sitemap.ts` — all product pages + blog posts |
| SEO | Per-post OpenGraph, Twitter Cards, JSON-LD BlogPosting, canonical URLs |
| Date-gating | `publishDate <= today` at build time |
| Publishing | Daily 5:30am cron rebuild (`30 5 * * *`) |
| Current posts | 448 (1 original + 395 batch 1 + 11 Thursday batch + 42 Monday batch 2) |
| Schedule | Daily, 5 Apr 2026 to 4 May 2027 (13 months) |
| Region gating | `region` field in frontmatter — "uk", "usa", or "all" (default). Blog index filters by visitor region. Badges on cards/posts. |
| Status | **DONE** — 448 articles total (395 daily + 11 Thu + 42 Mon batch 2) |

**Frontmatter fields:** title, slug, publishDate, author, category, excerpt, image, imageAlt, tags

**Categories:** Accounting & Finance (75), CRM & Estate Agents (50), Property Inventories (38), Timesheets & Workforce (38), HR & Payroll (55), Chat (37), Connect (37), Small Business & Growth (20), Industry Comparisons (45)

**Writing rules:**
- Subtly position Relentify as the modern alternative (not salesy)
- UK-focused but globally applicable
- Use `var(--theme-*)` CSS variables — no hardcoded colours
- 1,000–1,500 words per article
- Link to relevant product page where natural

**Full SEO content plan:** `/opt/plans/seo-blog-content-plan.md`

---

## Key Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout — ThemeProvider, RegionProvider, shared TopBar, Footer |
| `app/globals.css` | Tailwind, fonts, theme variables, utilities |
| `app/lib/themes.ts` | Theme presets (A/B/C/D) |
| `app/lib/blog.ts` | Blog markdown parsing utilities |
| `app/blog/page.tsx` | Blog index (server component) |
| `app/blog/BlogContent.tsx` | Blog index client component (framer-motion) |
| `app/blog/[slug]/page.tsx` | Individual blog post (server, async params) |
| `app/sitemap.ts` | Dynamic sitemap generation |
| `app/components/RegionSwitcher.tsx` | Region dropdown (passed to TopBar navLinks) |
| `app/components/Footer.tsx` | Footer with product + legal links |
| `app/components/Analytics.tsx` | GA + PostHog (combined) |
| `app/components/ChatWidget.tsx` | Chatwoot live chat widget |
| `app/components/CookieBanner.tsx` | Cookie consent |
| `next.config.js` | standalone output, transpilePackages |
| `Dockerfile` | Multi-stage build (turbo prune → pnpm → Next.js standalone) |
| `docker-compose.yml` | Container config (0.5 CPU, 384MB RAM) |

---

## External Services

- **Google Analytics**: GA-RGV6F6BLSP (via `Analytics.tsx`)
- **Chatwoot**: Live chat at chat.relentify.com (website token: ca9Jcc8BiJQD68gdgCyYPqKA). AI chatbot (Aria) responds via n8n workflow, escalates to human agents (Jon, Sarah).
- **PostHog**: Session recording + pageviews (via `Analytics.tsx`)

---

## Components

### From @relentify/ui (shared)
- `TopBar` — Floating pill navbar with dark mode toggle (replaces old local Navbar)
- `TopBarDropdown` — Apps dropdown in TopBar
- `Logo` — SVG R icon + "RELENTIFY" text
- `ThemeProvider` + `RegionProvider` — Theme/region context

### Marketing-Specific (local, in app/components/)
- `RegionSwitcher.tsx` — Region dropdown with flag icons (passed to TopBar)
- `Footer.tsx` — Links + copyright
- `Analytics.tsx` — GA + PostHog combined
- `ChatWidget.tsx` — Chatwoot script loader
- `CookieBanner.tsx` — GDPR banner

### Page Components
All in `src/app/pages/`:
- `Home.tsx` — Hero + LiquidityMonitor (mock cash flow UI) + feature cards
- `Accounting.tsx` — Pricing tiers (Sole Trader / Small Business / Growth)
- `Inventory.tsx`, `CRM.tsx`, `Timesheets.tsx`, `ESign.tsx`, `Websites.tsx`, `Payroll.tsx`, `Reminders.tsx` — Feature showcase pages
- `Blog.tsx` — Post cards linking to alternatives
- `Privacy.tsx` — Legal page
- `alternatives/` — AlternativesHub + Xero/QuickBooks comparison pages

---

## Styling

### Globals (`src/styles/globals.css`)
- Fonts: Inter, JetBrains Mono, Playfair Display, Space Grotesk, Space Mono, Outfit, Cormorant Garamond, IBM Plex, DM Serif, Sora, Instrument Serif, Fira Code
- `.shadow-cinematic` — multi-layer drop shadow
- `.rounded-cinematic` — 2rem (mobile) / 3rem (desktop)
- `.magnetic-btn` — hover scale
- `.noise-overlay` — fixed grain texture (5% opacity)

---

## Known Issues

1. **Duplicate themes.ts** — `src/app/themes.ts` duplicated in `src/styles/themes.ts` — consolidate
2. **Local utils duplication** — `cn()` exists here and in `@relentify/ui` — should import from package
3. **GEMINI.md outdated** — References Next.js but app is Vite
4. **Missing @relentify/ui migration** — Uses local ThemeContext/RegionContext instead of package versions

---

## Feature Status

| Feature | Status |
|---------|--------|
| Home page + hero | Done |
| Accounting pricing page | Done |
| Product pages (7) | Done |
| Blog infrastructure (markdown) | Done (2026-04-03) |
| Blog content (104 articles) | In progress — titles/keywords phase |
| Privacy policy | Done |
| Competitor comparisons (4) | Done |
| Sitemap (all pages + blog) | Done (2026-04-03) |
| Theme system (4 presets) | Done |
| Dark mode | Done |
| Region system (6 regions) | Done |
| Cookie banner | Done |
| Chatwoot live chat (AI + human) | Done |
| Google Analytics | Done |
| @relentify/ui migration | Not started |
