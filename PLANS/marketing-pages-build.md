# Marketing Pages — Detailed Build Plan

Comparison and pricing pages on relentify.com (apps/20marketing/).

**Master plan**: `/opt/relentify-monorepo/PLANS/communications-platform-master-plan.md`
**Depends on**: 29chat + 30connect (need product features to compare)
**This is deliverable 4 of 4.** Can be done in parallel with → `crm-integration-build.md`
**Previous**: `29chat-build.md` → `30connect-build.md` → **this**

---

## Overview

4 new pages in the existing `apps/20marketing/` Next.js app. Uses existing TopBar, Footer, theme system, and `@relentify/ui` components. All pages are `'use client'` (they use hooks, animations).

**Note**: 20marketing was migrated to Next.js 15 App Router in March 2026. Pages use `useTheme`, `useRegion`, `formatPrice`, `cn` from `@relentify/ui`. Reference existing pages for style patterns.

---

## Phase 1: `/chat` — Chat Landing Page

### File: `apps/20marketing/src/app/chat/page.tsx`

### Sections (top to bottom)

1. **Hero**
   - Headline: "Free live chat for your website"
   - Subheadline: "Unlimited agents. Unlimited history. Forever free."
   - CTA button: "Add to your website — it's free" → signup
   - Secondary CTA: "See how we compare to Tawk.to" → scroll to comparison
   - Hero image: screenshot of widget on a sample website

2. **Feature Grid**
   - 3x4 grid of features with icons (lucide-react)
   - Each feature: icon, title, one-line description
   - Features: Unlimited agents, File sharing, Canned responses, Knowledge base, Ticketing, Visitor monitoring, Automated triggers, Pre-chat forms, CSAT ratings, Internal notes, Multi-language, Webhooks API
   - All labelled "FREE" with a badge

3. **"More than Tawk.to" Section**
   - Side-by-side: what they offer free vs what we offer free
   - Highlight our extras: Customer portal, SLA management, Collision detection
   - "We give you more — for the same price (free)."

4. **Comparison Table** (from master plan)
   - Full feature-for-feature table: Tawk.to vs Relentify Chat
   - Two columns (Free features + Paid add-ons)
   - Green checkmarks for both, red X for gaps
   - Pricing row at bottom: Tawk.to $29/$29 vs Relentify £24.99/£24.99

5. **Pricing Section**
   - Simple 3-card layout:
     - **Free** — "Everything you need" — list of features — "Get started free"
     - **Remove Branding** — "+£24.99/mo" — "Your brand, not ours"
     - **AI Assist** — "+£24.99/mo" — "AI answers from your knowledge base"
   - Currency shown via region switcher (£ default, $ for non-UK)

6. **Widget Demo** (mini version — full demo on /chat/demo)
   - Embedded live widget.js on the page
   - "Try it right now — click the chat bubble"
   - Connected to a demo entity with sample KB articles and bot

7. **CTA Footer**
   - "Add Relentify Chat to your website in 2 minutes"
   - Code snippet preview: `<script src="https://chat.relentify.com/widget.js" data-entity-id="YOUR_ID"></script>`
   - "Sign up free" button

---

## Phase 2: `/connect` — Connect Landing Page

### File: `apps/20marketing/src/app/connect/page.tsx`

### Sections

1. **Hero**
   - Headline: "Everything Zendesk charges £227/agent for. We charge £119."
   - Subheadline: "Multi-channel helpdesk with AI, voice, bots, and workflows. Per seat, no surprises."
   - CTA: "Start free trial" → signup
   - Channel icons row: chat bubble, email, WhatsApp, phone, SMS, Facebook, Instagram

2. **Channel Showcase**
   - Visual cards for each channel (web chat, email, WhatsApp, SMS, Facebook, Instagram, voice)
   - Each card: channel icon, "Receive and send from one inbox", screenshot mockup

3. **Key Features Grid**
   - 4x3 grid: Unified inbox, AI auto-reply, No-code bots, Workflow automation, SLA management, Knowledge base, Voice (VoIP), Custom reports, QA scoring, Customer portal, CSAT surveys, Audit log
   - Each with icon + 2-line description

4. **Bot Builder Preview**
   - Screenshot/mockup of the visual bot builder
   - "Build conversational bots without code"
   - Example flow shown visually

5. **Intercom Comparison Table** (from master plan)
   - 3 tiers side by side: Intercom Essential/Advanced/Expert vs Relentify Essentials/Professional/Enterprise
   - Feature-for-feature comparison
   - Price comparison row
   - "Save X% with Relentify" callout per tier

6. **Zendesk Comparison Table** (from master plan)
   - 4 tiers: ZD Support Team/Suite Team/Professional/Enterprise vs Relentify Starter/Growth/Professional/Enterprise
   - Feature-for-feature comparison
   - "Zendesk fully loaded: ~£227/agent. Relentify: £119/agent." callout

7. **Savings Calculator** (interactive)
   - Input: "How many agents do you have?" (slider or number input)
   - Input: "Which plan?" (radio: Starter / Essentials / Growth / Professional / Enterprise)
   - Output: "You'd pay £X/mo. On Zendesk: £Y/mo. You save Z%."
   - Visual bar chart comparison
   - Component: `src/app/components/SavingsCalculator.tsx`

8. **Pricing Section**
   - 5 cards (Starter → Enterprise) with features list and price
   - Toggle: Monthly / Annual (annual = 2 months free? TBD)
   - "All plans include AI" badge
   - Region switcher shows £ or $

9. **CTA Footer**
   - "Switch from Zendesk in a day. We'll help you migrate."
   - "Start free trial" button

---

## Phase 3: `/pricing` — All Plans Page

### File: `apps/20marketing/src/app/pricing/page.tsx`

### Sections

1. **Hero**
   - "Simple, transparent pricing"
   - Toggle: Chat / Connect (show relevant pricing)

2. **Chat Pricing**
   - Free + add-on cards (same as /chat pricing section)

3. **Connect Pricing**
   - 5 tier cards (same as /connect pricing section)
   - Monthly/Annual toggle

4. **Feature Comparison Matrix**
   - Expandable accordion rows grouped by category (Channels, Ticketing, AI, Routing, Voice, Bots, Analytics, QA, Admin)
   - Columns: Starter, Essentials, Growth, Professional, Enterprise
   - Checkmarks / limits / "Add-on" indicators
   - Component: `src/app/components/FeatureMatrix.tsx`

5. **FAQ Section**
   - "What happens if I go over my AI resolution limit?" — $0.99/resolution overage
   - "How does voice billing work?" — Usage-based via Twilio, billed monthly
   - "Can I switch plans?" — Yes, any time, prorated
   - "Is there a free trial?" — 14 days free on any Connect plan
   - "What payment methods do you accept?" — All major cards via Stripe
   - "Do you offer annual billing?" — Yes, 2 months free
   - Component: `src/app/components/PricingFAQ.tsx`

6. **CTA**
   - "Start free" (Chat) / "Start free trial" (Connect)

---

## Phase 4: `/chat/demo` — Interactive Widget Demo

### File: `apps/20marketing/src/app/chat/demo/page.tsx`

### Layout
Split screen:
- **Left side**: sample website mockup (static HTML/image) with the live widget.js embedded
- **Right side**: agent inbox view (screenshot or live embed showing the other side of the conversation)

### Implementation
- Embed actual `widget.js` from `chat.relentify.com` with a demo entity ID
- Demo entity has:
  - Sample KB articles (pricing, features, getting started)
  - AI auto-reply enabled (answers from KB)
  - Custom greeting: "Welcome! This is a live demo of Relentify Chat."
  - Bot flow: greeting → topic selection → AI answer or handoff
- Visitor can send real messages, get real AI responses
- No actual human agent on the other end (AI-only for demo)

### Callouts
- "This is a live widget — try sending a message"
- "AI is answering from our knowledge base"
- "Your customers see this. Your agents see the inbox."
- "Add this to your website in 2 minutes"

---

## New Components

| Component | Used on | Purpose |
|-----------|---------|---------|
| `src/app/components/ComparisonTable.tsx` | /chat, /connect | Reusable comparison table (competitor vs us) |
| `src/app/components/SavingsCalculator.tsx` | /connect | Interactive agent count → savings calculator |
| `src/app/components/FeatureMatrix.tsx` | /pricing | Expandable feature comparison grid |
| `src/app/components/PricingFAQ.tsx` | /pricing | FAQ accordion |
| `src/app/components/PricingCards.tsx` | /chat, /connect, /pricing | Reusable pricing card row |
| `src/app/components/ChannelIcons.tsx` | /connect | Channel icon row (chat, email, WhatsApp, etc.) |

All components use `@relentify/ui` primitives and theme variables. No local UI components.

---

## Navigation Updates

### TopBar changes in `apps/20marketing/`

Add to the "Products" or "Suite" dropdown:
- **Chat** → `/chat` (with subtext: "Free live chat widget")
- **Connect** → `/connect` (with subtext: "Multi-channel helpdesk")

Add **Pricing** as a top-level nav link.

---

## SEO

Each page needs:
- `metadata` export with title, description, OpenGraph, Twitter cards
- JSON-LD schema (Product, Offer)
- Canonical URL
- h1/h2 hierarchy

### Titles
- `/chat`: "Free Live Chat Widget for Your Website | Relentify Chat"
- `/connect`: "Multi-Channel Helpdesk — Cheaper than Zendesk | Relentify Connect"
- `/pricing`: "Relentify Pricing — Plans Starting Free"
- `/chat/demo`: "Try Relentify Chat — Live Demo"

---

## Build Steps

1. Create all page files and components
2. Update 20marketing TopBar navigation
3. Verify locally: `pnpm --filter marketing dev`
4. Docker rebuild: `cd /opt/relentify-monorepo/apps/20marketing && docker compose build --no-cache && docker compose up -d`
5. Verify live: `curl https://relentify.com/chat`, `/connect`, `/pricing`
6. Test widget demo works on `/chat/demo`
7. `docker builder prune -f`

---

## Verification

1. `/chat` loads — hero, features, comparison table, pricing, demo widget
2. `/connect` loads — hero, channels, features, Intercom table, Zendesk table, calculator, pricing
3. `/pricing` loads — toggle, cards, feature matrix, FAQ
4. `/chat/demo` loads — widget is interactive, AI responds
5. Savings calculator computes correct values
6. Region switcher changes £ to $ on pricing
7. All CTAs link to signup
8. Mobile responsive
9. SEO: meta tags present, JSON-LD valid
