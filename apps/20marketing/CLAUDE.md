# 20marketing — Marketing Website

**Container**: `relentify-com` | **Port**: 3020 → 3000 (nginx) | **Runtime**: Vite + React 19 | **Database**: None

Static SPA marketing site at `relentify.com`. No backend API — all content is client-side rendered via React Router and served through nginx.

---

## Tech Stack

- **Framework**: Vite 6.4 + React 19 + React Router 6.30
- **Styling**: Tailwind CSS 4.2 with CSS variables (theme system)
- **Animations**: GSAP 3.14, Motion 11.18
- **Icons**: Lucide React 0.400
- **Server**: Nginx (static SPA with `try_files` fallback)
- **Build**: Multi-stage Docker (turbo prune → pnpm → vite build → nginx)

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

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Home` | Hero + LiquidityMonitor + feature overview |
| `/accounting` | `Accounting` | Pricing tiers + feature comparison |
| `/inventory` | `Inventory` | Property Inventories product page |
| `/crm` | `CRM` | CRM product page |
| `/reminders` | `Reminders` | Reminders product page |
| `/timesheets` | `Timesheets` | Timesheets product page |
| `/esign` | `ESign` | E-Sign product page |
| `/websites` | `Websites` | Websites product page |
| `/payroll` | `Payroll` | Payroll & HR product page |
| `/blog` | `Blog` | Blog post listing |
| `/privacy` | `Privacy` | Privacy policy |
| `/alternatives` | `AlternativesHub` | Competitor comparison hub |
| `/xero-alternative` | `XeroAlternative` | Xero competitor positioning |
| `/xero-v-relentify` | `XeroVsRelentify` | Xero vs Relentify comparison |
| `/quickbooks-alternative` | `QuickBooksAlternative` | QuickBooks competitor positioning |
| `/quickbooks-v-relentify` | `QuickBooksVsRelentify` | QuickBooks vs Relentify comparison |

**Total**: 16 routes

---

## API Routes

None. This is a static frontend-only app.

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

## Key Files

| File | Purpose |
|------|---------|
| `src/app/App.tsx` | Router + context providers |
| `src/app/main.tsx` | React entry point |
| `src/app/themes.ts` | Theme presets (A/B/C/D) |
| `src/app/lib/utils.ts` | `cn()`, `formatPrice()`, `getCurrencySymbol()`, `getRegionMultiplier()` |
| `src/app/components/Navbar.tsx` | Marketing navbar with Apps dropdown + region switcher |
| `src/app/components/Footer.tsx` | Footer with links |
| `src/app/components/ThemeSwitcher.tsx` | Dark mode toggle |
| `src/app/components/CookieBanner.tsx` | Cookie consent |
| `src/styles/globals.css` | Tailwind, fonts, theme variables, utilities |
| `index.html` | Vite entry (GA + Chatwoot scripts) |
| `vite.config.ts` | React + Tailwind plugins |
| `nginx.conf` | SPA routing + gzip |
| `Dockerfile` | Multi-stage build (turbo prune → pnpm → nginx) |
| `docker-compose.yml` | Container config (0.5 CPU, 256MB RAM) |

---

## External Services

- **Google Analytics**: GA-RGV6F6BLSP (in `index.html`)
- **Chatwoot**: Live chat at chat.relentify.com (website token: ca9Jcc8BiJQD68gdgCyYPqKA). AI chatbot responds via n8n workflow, escalates to human agents.

---

## Components

### Marketing-Specific (stay local, not in @relentify/ui)
- `Navbar.tsx` — Apps dropdown, region switcher, Chatwoot toggle
- `Footer.tsx` — Links + copyright
- `Logo.tsx` — SVG brand icon
- `ThemeSwitcher.tsx` — Dark mode button
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
| Blog page | Done |
| Privacy policy | Done |
| Competitor comparisons (4) | Done |
| Theme system (4 presets) | Done |
| Dark mode | Done |
| Region system (6 regions) | Done |
| Cookie banner | Done |
| Chatwoot live chat (AI + human) | Done |
| Google Analytics | Done |
| @relentify/ui migration | Not started |
