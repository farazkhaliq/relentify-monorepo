# UI/UX Animations — Framer Motion System

**Date:** 2026-03-26
**Scope:** `packages/ui` (shared component library) + `apps/22accounting` (page-level)
**Priority:** 2

---

## Objective

Replace all CSS-only transitions in `@relentify/ui` with a Framer Motion spring animation system that feels fast, physically natural, and consistent — referencing Apple iOS/macOS, Stripe, Linear, Notion, and Figma as the quality benchmark.

**Timing discipline:** All interactions must perceivably settle within **180–220ms**. Nothing should feel floaty or slow. Springs are tuned to hit this without explicitly setting duration (spring physics handles it). Any deviation from this feel should be treated as a bug.

---

## Architecture

### Dependencies

Add to `packages/ui/package.json`:
```json
"framer-motion": "^11.0.0"
```

No app installs Framer Motion directly. All animation behaviour comes through `@relentify/ui`.

### Bundle Strategy

Use `LazyMotion` with the `domAnimation` feature subset (~18KB gzipped vs ~34KB full). This covers all required interactions: tap, hover, entrance/exit, presence, layout. Excludes unused features (SVG path drawing, drag with inertia).

### New Files in `packages/ui/src/`

```
src/
  animations.ts         ← single source of truth: spring presets, variants, stagger
  MotionProvider.tsx    ← LazyMotion wrapper, reduced motion detection
```

---

## `animations.ts` — Complete Source of Truth

### Spring Presets

```ts
export const spring = {
  // Fast, tight, immediate — buttons, toggles, dropdowns
  // Tuned for Apple/Linear tightness
  snappy: { type: 'spring', stiffness: 500, damping: 34, mass: 0.7 },

  // Weighted, graceful — modals, sheets, panels
  smooth: { type: 'spring', stiffness: 360, damping: 32, mass: 1.0 },

  // Soft, background — page transitions, overlays
  gentle: { type: 'spring', stiffness: 260, damping: 28, mass: 1.1 },

  // Slight overshoot — success states, notifications, checkboxes
  bounce: { type: 'spring', stiffness: 420, damping: 22, mass: 0.8 },
} as const;
```

| Preset | Feel | Used for |
|--------|------|----------|
| `snappy` | Fast, tight, Apple-tight | Buttons, toggles, chips, dropdowns |
| `smooth` | Weighted, graceful | Modals, sheets, panels |
| `gentle` | Soft, background | Page transitions, overlays |
| `bounce` | Slight overshoot | Success states, notifications, checkboxes |

### Stagger System

```ts
// Use with staggerChildren in parent variants
export const stagger = {
  fast:   0.04,  // lists, chips
  normal: 0.06,  // dashboard cards, chart items
  slow:   0.08,  // onboarding, first-load sequences
} as const;
```

Usage pattern:
```ts
// Parent
const listVariants = {
  visible: { transition: { staggerChildren: stagger.normal } }
};
// Child uses any standard variant (slideUp, fade, etc.)
```

### Standard Variants

```ts
export const variants = {
  // Button interactions — scale + y gives physical depth
  tap: {
    rest:    { scale: 1,     opacity: 1,    y: 0 },
    pressed: { scale: 0.97,  opacity: 0.95, y: 1 },   // y: 1 = pressed into surface
  },
  // Hover — subtle lift + slight opacity pull
  hover: {
    rest:    { scale: 1,     opacity: 1    },
    hovered: { scale: 1.015, opacity: 0.98 },
  },
  // Modal / dialog entrance
  modal: {
    hidden:  { opacity: 0, scale: 0.96, y: 8 },
    visible: { opacity: 1, scale: 1,    y: 0 },
    exit:    { opacity: 0, scale: 0.96, y: 4 },
  },
  // Dropdown / popover / select
  dropdown: {
    hidden:  { opacity: 0, y: -6, scale: 0.98 },
    visible: { opacity: 1, y: 0,  scale: 1    },
    exit:    { opacity: 0, y: -4, scale: 0.98 },
  },
  // Toast / sheet / bottom-up entrance
  slideUp: {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0  },
    exit:    { opacity: 0, y: 8  },
  },
  // Overlays, skeletons, simple fades
  fade: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
    exit:    { opacity: 0 },
  },
} as const;
```

No animation value is ever hardcoded inside a component. All components import from `animations.ts`.

---

## `MotionProvider.tsx`

Wraps the app root with:
- `LazyMotion` (loads `domAnimation` feature set)
- `useReducedMotion()` detection

### Reduced Motion Strategy

When `prefers-reduced-motion: reduce` is detected:
- **Disable:** all `scale` transforms, all positional movement (`x`, `y`)
- **Keep:** `opacity` transitions only (fades are still permitted — they orient the user without causing vestibular discomfort)
- **Implementation:** `MotionProvider` reads `useReducedMotion()` and injects a context value. A `useAnimationConfig()` hook exported from `animations.ts` returns either the full config or opacity-only overrides based on this context.

```ts
// In MotionProvider
const reducedMotion = useReducedMotion();

// Hook used by components
export function useAnimationConfig() {
  const reduced = useContext(ReducedMotionContext);
  if (reduced) {
    return {
      spring: { type: 'tween', duration: 0.15, ease: 'easeOut' },
      variants: {
        // All variants collapsed to opacity-only
        tap:      { rest: { opacity: 1 }, pressed: { opacity: 0.85 } },
        hover:    { rest: { opacity: 1 }, hovered: { opacity: 0.9  } },
        modal:    { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } },
        dropdown: { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } },
        slideUp:  { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } },
        fade:     { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } },
      },
    };
  }
  return { spring, variants };
}
```

Each app adds `<MotionProvider>` once to its root layout. No per-page setup.

---

## Component Updates

### Tier 1 — High impact

| Component | Change |
|-----------|--------|
| `Button` | `motion.button`. `whileTap={variants.tap.pressed}` (scale + opacity + y:1), `whileHover={variants.hover.hovered}` (scale + opacity). `spring.snappy`. Remove all CSS `transition`. |
| `Dialog` / `AlertDialog` | `AnimatePresence` + `motion.div` with `modal` variant. `spring.smooth`. |
| `Sheet` | Slide from edge (`x` or `y`). `AnimatePresence`. `spring.smooth`. |
| `DropdownMenu` / `Dropdown` | `dropdown` variant on menu panel. `AnimatePresence`. `spring.snappy`. |
| `Toast` | `slideUp` variant per item. `AnimatePresence` removes on dismiss. `spring.smooth`. |
| `Switch` | `motion.span` on thumb. `spring.snappy` on `x` position. |

### Tier 2 — Secondary interactions

| Component | Change |
|-----------|--------|
| `Popover` | `fade` + scale 0.97→1. `spring.snappy`. |
| `Tabs` | Active indicator: `motion.div` with `layoutId`. `spring.snappy`. Uses `layout` prop — permitted here (tab indicator is a single moving element, not a reflow trigger). |
| `Checkbox` | Check icon scales in with `spring.bounce`. |
| `Card` / `StatsCard` | `whileHover` y: -2 lift only. **No shadow changes alongside lift** — keeps it from feeling like cheap SaaS. Use sparingly on dashboard; not on every card. |
| `Select` | Same as `Dropdown`. |
| `Command` (combobox) | `dropdown` variant on list panel. |
| `ThemeToggleButton` | Icon rotates 180° via `motion.span`. `spring.snappy`. |
| `Progress` | `motion.div` width animates to value. `spring.smooth`. |
| `UserMenu` | `dropdown` variant. |

### Tier 3 — Focus states (keyboard navigation)

Focus states must not rely on browser default outlines alone. Animated focus feedback:

- **Button / interactive elements:** On `:focus-visible`, animate a subtle `boxShadow` ring using CSS (not Framer Motion — focus rings are triggered by CSS pseudo-class, not JS). Use `transition: box-shadow 120ms ease-out`.
- **Input / Textarea / Select:** On focus, border color transitions to `var(--theme-primary)` with CSS `transition: border-color 120ms ease-out`. Optional: slight `scale: 1.005` via Framer Motion `whileFocus` for a subtle "active" signal.
- **Rule:** Focus states must be visible, but must not be heavier than hover states. Subtle ring, not a glowing outline.

### Layout Animations — Controlled Use

`layout` prop is expensive and must not be used freely. Permitted cases only:

| Permitted | Component | Reason |
|-----------|-----------|--------|
| ✅ | Tabs indicator | Single moving `div`, minimal reflow |
| ✅ | Expandable sections (accordion-style) | Content height change is the whole point |
| ✅ | List reordering (if we build drag-and-drop) | Required for correct position animation |
| ❌ | Dashboard cards | Too many elements, causes layout thrash |
| ❌ | Table rows | Performance impact at 50+ rows |
| ❌ | Any element inside a scroll container without `layoutScroll` | Will cause incorrect positioning |

### No animation — intentionally excluded

`Skeleton` (keep CSS pulse), `Separator`, `ScrollArea`, `Label`, `Avatar`, `Logo`, `Table` rows, `PageHeader`, `NoiseOverlay`, `Calendar`, `RadioGroup` (uses Switch pattern, already covered).

---

## 22accounting — App-Level Animations

These are specific to 22accounting and live in the app, not the shared UI:

**Page transitions:** Wrap dashboard page content in `motion.div` with `slideUp` variant. Triggers on route change via `key={pathname}`. `spring.gentle`.

**Form validation shake:** Tight, premium feel — not cartoon:
```ts
x: [0, -4, 4, -2, 2, 0]
```
Animate with `spring.bounce`. Shorter displacement than the original spec — reads as "wrong" without feeling exaggerated.

**Dashboard chart entrance:** Charts animate in with `fade` variant on first mount. Stagger children at `stagger.normal` (60ms) using the standard stagger system.

**List items (invoices, bills, expenses):** When items appear after a filter change or load, stagger with `stagger.fast` (40ms) and `slideUp` variant.

---

## Performance Rules

- Never use `layout` prop outside the permitted list above
- No `whileInView` on elements that appear above the fold
- `AnimatePresence mode="wait"` only where exit must complete before entrance (modals). Default mode elsewhere.
- Framer Motion handles `will-change: transform` automatically — do not manually set it
- Do not animate `width` or `height` directly on large containers — use `scaleX`/`scaleY` or `max-height` with overflow hidden
- Card hover lift (`y: -2`) must not be applied to more than ~4 cards visible simultaneously on the dashboard — too many moving elements dilutes the premium feel

---

## Fallback Policy

CSS transitions are permitted only for:
- Color changes (`border-color`, `background-color`, `color`) — these are CSS-native and appropriate
- `box-shadow` for focus rings (CSS pseudo-class driven, not JS-driven)
- `opacity` on elements that never unmount

All mount/unmount animations, scale animations, position animations: Framer Motion only.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `packages/ui/package.json` | Add `framer-motion` dependency |
| `packages/ui/src/animations.ts` | New: spring presets, stagger constants, variants, `useAnimationConfig` hook |
| `packages/ui/src/MotionProvider.tsx` | New: LazyMotion wrapper + reduced motion context |
| `packages/ui/src/index.ts` | Export `MotionProvider`, `spring`, `variants`, `stagger`, `useAnimationConfig` |
| `packages/ui/src/components/ui/Button.tsx` | motion.button + tap (scale+opacity+y) + hover (scale+opacity) |
| `packages/ui/src/components/ui/Dialog.tsx` | AnimatePresence + modal variant |
| `packages/ui/src/components/ui/AlertDialog.tsx` | AnimatePresence + modal variant |
| `packages/ui/src/components/ui/Sheet.tsx` | AnimatePresence + slide variant |
| `packages/ui/src/components/ui/DropdownMenu.tsx` | AnimatePresence + dropdown variant |
| `packages/ui/src/components/ui/Dropdown.tsx` | AnimatePresence + dropdown variant |
| `packages/ui/src/components/ui/Toast.tsx` | AnimatePresence + slideUp variant |
| `packages/ui/src/components/ui/Switch.tsx` | motion.span on thumb |
| `packages/ui/src/components/ui/Input.tsx` | whileFocus scale + CSS border-color transition |
| `packages/ui/src/components/ui/Textarea.tsx` | whileFocus scale + CSS border-color transition |
| `packages/ui/src/components/ui/Popover.tsx` | fade + scale variant |
| `packages/ui/src/components/ui/Tabs.tsx` | layoutId indicator |
| `packages/ui/src/components/ui/Checkbox.tsx` | bounce on check |
| `packages/ui/src/components/ui/Card.tsx` | whileHover y: -2 lift (no shadow change) |
| `packages/ui/src/components/ui/StatsCard.tsx` | whileHover y: -2 lift (no shadow change) |
| `packages/ui/src/components/ui/Select.tsx` | dropdown variant |
| `packages/ui/src/components/ui/Command.tsx` | dropdown variant |
| `packages/ui/src/components/ui/ThemeToggleButton.tsx` | rotate on switch |
| `packages/ui/src/components/ui/Progress.tsx` | animated width |
| `packages/ui/src/components/ui/UserMenu.tsx` | dropdown variant |
| `apps/22accounting/app/dashboard/layout.tsx` | MotionProvider + page transitions keyed on pathname |
| `apps/22accounting/src/components/` | Form validation shake (x: [0,-4,4,-2,2,0]) |
| Each app `layout.tsx` | Add `<MotionProvider>` |
