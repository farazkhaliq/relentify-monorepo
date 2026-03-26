# UI/UX Animations — Framer Motion System

**Date:** 2026-03-26
**Scope:** `packages/ui` (shared component library) + `apps/22accounting` (page-level)
**Priority:** 2

---

## Objective

Replace all CSS-only transitions in `@relentify/ui` with a Framer Motion spring animation system that feels fast, physically natural, and consistent — referencing Apple iOS/macOS, Stripe, Linear, Notion, and Figma as the quality benchmark.

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
  animations.ts         ← single source of truth: spring presets + variants
  MotionProvider.tsx    ← LazyMotion wrapper, reduced motion detection
```

---

## `animations.ts` — Spring Presets & Variants

### Spring Presets (four types)

```ts
export const spring = {
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 },
  smooth: { type: 'spring', stiffness: 320, damping: 30, mass: 1.0 },
  gentle: { type: 'spring', stiffness: 240, damping: 26, mass: 1.0 },
  bounce: { type: 'spring', stiffness: 360, damping: 20, mass: 0.9 },
} as const;
```

| Preset | Feel | Used for |
|--------|------|----------|
| `snappy` | Fast, tight, immediate | Buttons, toggles, chips, dropdowns |
| `smooth` | Weighted, graceful | Modals, sheets, panels |
| `gentle` | Soft, background | Page transitions, overlays |
| `bounce` | Slight overshoot | Success states, notifications |

### Standard Variants

```ts
export const variants = {
  tap:      { rest: { scale: 1 }, pressed: { scale: 0.97 } },
  hover:    { rest: { scale: 1 }, hovered: { scale: 1.015 } },
  modal:    {
    hidden:  { opacity: 0, scale: 0.96, y: 8 },
    visible: { opacity: 1, scale: 1,    y: 0 },
    exit:    { opacity: 0, scale: 0.96, y: 4 },
  },
  dropdown: {
    hidden:  { opacity: 0, y: -6, scale: 0.98 },
    visible: { opacity: 1, y: 0,  scale: 1    },
    exit:    { opacity: 0, y: -4, scale: 0.98 },
  },
  slideUp: {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0  },
    exit:    { opacity: 0, y: 8  },
  },
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
- `useReducedMotion()` — if `true`, overrides all transition durations to `0`. Zero custom logic required.

Each app adds `<MotionProvider>` once to its root layout. No per-page setup.

---

## Component Updates

### Tier 1 — High impact

| Component | Change |
|-----------|--------|
| `Button` | Replace with `motion.button`. Add `whileTap={variants.tap.pressed}`, `whileHover={variants.hover.hovered}`, transition `spring.snappy`. Remove all CSS `transition` on button. |
| `Dialog` / `AlertDialog` | Wrap content in `AnimatePresence` + `motion.div` with `modal` variant, `spring.smooth` transition. |
| `Sheet` | Slide from edge using `x` or `y` offset. `AnimatePresence` controls mount/unmount. `spring.smooth`. |
| `DropdownMenu` / `Dropdown` | `dropdown` variant on the menu panel. `AnimatePresence`. `spring.snappy`. |
| `Toast` | `slideUp` variant on each toast item. `AnimatePresence` removes on dismiss. `spring.smooth`. |
| `Switch` | Replace CSS `transition` on thumb with `motion.span` using `spring.snappy` on `x` position. |

### Tier 2 — Secondary interactions

| Component | Change |
|-----------|--------|
| `Popover` | `fade` + scale 0.97→1. `spring.snappy`. |
| `Tabs` | Active indicator is a `motion.div` with `layoutId` — slides between tabs. `spring.snappy`. |
| `Checkbox` | Check icon scales in with `spring.bounce` on tick. |
| `Card` / `StatsCard` | `whileHover` y: -2 lift. `spring.smooth`. |
| `Select` | Same as `Dropdown`. |
| `Command` (combobox) | `dropdown` variant on the list panel. |
| `ThemeToggleButton` | Icon rotates 180° via `motion.span` `rotate`. `spring.snappy`. |
| `Progress` | Animate bar width to value using `motion.div` `width` + `spring.smooth`. |
| `UserMenu` | `dropdown` variant. |

### No animation — intentionally excluded

`Skeleton` (keep CSS pulse), `Separator`, `ScrollArea`, `Label`, `Avatar`, `Logo`, `Table` rows, `PageHeader`, `NoiseOverlay`, `Calendar`, `RadioGroup` (uses Switch pattern, already covered).

---

## 22accounting — App-Level Animations

These are specific to 22accounting and live in the app, not the shared UI:

**Page transitions:** Wrap dashboard page content in a `motion.div` with `slideUp` variant. Triggers on route change. `spring.gentle`.

**Form validation shake:** On field-level validation error, animate `x: [0, -6, 6, -4, 4, 0]` using `spring.bounce`. Gives physical feedback that input is rejected.

**Dashboard chart entrance:** Charts animate in with `fade` variant on first mount. Stagger children by 60ms.

---

## Performance Rules

- Never use `layout` prop without explicit need — it triggers expensive layout recalculations
- No `whileInView` on elements that appear above the fold
- All `AnimatePresence` components should set `mode="wait"` only where exit animations must complete before entrance (modals). Elsewhere use default mode.
- Framer Motion handles `will-change: transform` automatically — do not manually set it

---

## Fallback Policy

CSS transitions are permitted only for:
- Color changes (hover states on text/icons where scale is not appropriate)
- `opacity` on elements that never unmount (e.g. disabled state overlay)

All mount/unmount animations, all scale animations, all position animations: Framer Motion only.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `packages/ui/package.json` | Add `framer-motion` dependency |
| `packages/ui/src/animations.ts` | New: spring presets + variants |
| `packages/ui/src/MotionProvider.tsx` | New: LazyMotion wrapper |
| `packages/ui/src/index.ts` | Export `MotionProvider`, `spring`, `variants` |
| `packages/ui/src/components/ui/Button.tsx` | motion.button + tap/hover variants |
| `packages/ui/src/components/ui/Dialog.tsx` | AnimatePresence + modal variant |
| `packages/ui/src/components/ui/AlertDialog.tsx` | AnimatePresence + modal variant |
| `packages/ui/src/components/ui/Sheet.tsx` | AnimatePresence + slide variant |
| `packages/ui/src/components/ui/DropdownMenu.tsx` | AnimatePresence + dropdown variant |
| `packages/ui/src/components/ui/Dropdown.tsx` | AnimatePresence + dropdown variant |
| `packages/ui/src/components/ui/Toast.tsx` | AnimatePresence + slideUp variant |
| `packages/ui/src/components/ui/Switch.tsx` | motion.span on thumb |
| `packages/ui/src/components/ui/Popover.tsx` | fade + scale variant |
| `packages/ui/src/components/ui/Tabs.tsx` | layoutId indicator |
| `packages/ui/src/components/ui/Checkbox.tsx` | bounce on check |
| `packages/ui/src/components/ui/Card.tsx` | whileHover lift |
| `packages/ui/src/components/ui/StatsCard.tsx` | whileHover lift |
| `packages/ui/src/components/ui/Select.tsx` | dropdown variant |
| `packages/ui/src/components/ui/Command.tsx` | dropdown variant |
| `packages/ui/src/components/ui/ThemeToggleButton.tsx` | rotate on switch |
| `packages/ui/src/components/ui/Progress.tsx` | animated width |
| `packages/ui/src/components/ui/UserMenu.tsx` | dropdown variant |
| `apps/22accounting/app/dashboard/layout.tsx` | MotionProvider + page transitions |
| `apps/22accounting/src/components/` | Form validation shake where applicable |
| Each app `layout.tsx` | Add `<MotionProvider>` |
