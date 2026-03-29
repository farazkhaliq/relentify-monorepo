# UI Animations — Framer Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all CSS-only transitions in `@relentify/ui` with a Framer Motion spring animation system that feels physically natural and premium.

**Architecture:** Create a single `animations.ts` source of truth for spring presets and variants; wrap Radix overlays (Dialog, Sheet, DropdownMenu, Popover) with `motion(Primitive.Content)` for spring entrance while keeping fast CSS exit; give Button, Switch, Checkbox, Card, Toast full Framer Motion treatment; add page transitions + form shake to 22accounting.

**Tech Stack:** framer-motion ^12 (already installed in `packages/ui`), TypeScript, Next.js 15 App Router, `@radix-ui/*` Radix primitives.

**ChatGPT improvements incorporated:**
- Snappier spring values (higher stiffness, lower mass)
- Press depth: `y: 1` added to pressed state (physical push feel)
- Opacity layering: `opacity: 0.98` hover, `opacity: 0.95` pressed
- Layout animations: `layout` / `layoutId` on key list/panel components

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `packages/ui/src/animations.ts` | Create | Single source of truth: spring presets + motion variants |
| `packages/ui/src/MotionProvider.tsx` | Create | Client wrapper exporting MotionProvider component |
| `packages/ui/src/index.ts` | Modify | Export `spring`, `variants`, `MotionProvider` |
| `packages/ui/src/components/ui/Button.tsx` | Modify | `motion.button`, whileTap/whileHover with y+opacity |
| `packages/ui/src/components/ui/Dialog.tsx` | Modify | `motion(DialogPrimitive.Content)` spring entrance |
| `packages/ui/src/components/ui/AlertDialog.tsx` | Modify | Same pattern as Dialog |
| `packages/ui/src/components/ui/Sheet.tsx` | Modify | Directional spring slide in |
| `packages/ui/src/components/ui/DropdownMenu.tsx` | Modify | `motion(DropdownMenuPrimitive.Content)` spring entrance |
| `packages/ui/src/components/ui/Dropdown.tsx` | Modify | Update existing spring values to match presets |
| `packages/ui/src/components/ui/Toast.tsx` | Modify | Full `AnimatePresence` + slideUp (we own state) |
| `packages/ui/src/components/ui/Switch.tsx` | Modify | Track state locally, `motion.span` thumb with spring x |
| `packages/ui/src/components/ui/Checkbox.tsx` | Modify | `AnimatePresence` + bounce scale on Check icon |
| `packages/ui/src/components/ui/Popover.tsx` | Modify | `motion(PopoverPrimitive.Content)` fade+scale entrance |
| `packages/ui/src/components/ui/Card.tsx` | Modify | `motion.div`, `whileHover` y:-2 lift |
| `packages/ui/src/components/ui/StatsCard.tsx` | Modify | `motion.div`, `whileHover` y:-2 lift |
| `packages/ui/src/components/ui/ThemeToggleButton.tsx` | Modify | `motion.span` icon rotation |
| `packages/ui/src/components/ui/Progress.tsx` | Modify | `motion.div` animated width |
| `packages/ui/src/components/ui/Tabs.tsx` | Modify | Update TabsNav `layoutId` spring to match `spring.snappy` |
| `apps/22accounting/app/dashboard/layout.tsx` | Modify | Add `MotionProvider` + page transition wrapper |

---

## Task 1: Foundation — animations.ts + MotionProvider.tsx

**Files:**
- Create: `packages/ui/src/animations.ts`
- Create: `packages/ui/src/MotionProvider.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create animations.ts**

Create `packages/ui/src/animations.ts`:

```ts
// animations.ts — single source of truth for all Framer Motion spring presets and variants.
// All UI components import from here. Never hardcode animation values in components.

import type { Transition } from 'framer-motion'

// ─── Spring Presets ───────────────────────────────────────────────────────────
// Tuned for Apple iOS / Linear / Stripe reference quality.
// Higher stiffness + lower mass = snappier, more responsive feel.

export const spring = {
  /** Fast, tight, immediate. Buttons, toggles, chips, dropdowns. */
  snappy: { type: 'spring', stiffness: 500, damping: 34, mass: 0.7 } as Transition,
  /** Weighted, graceful. Modals, sheets, panels. */
  smooth: { type: 'spring', stiffness: 360, damping: 32, mass: 1.0 } as Transition,
  /** Soft, background. Page transitions, overlays. */
  gentle: { type: 'spring', stiffness: 260, damping: 28, mass: 1.1 } as Transition,
  /** Slight overshoot. Success states, notifications, checkbox tick. */
  bounce: { type: 'spring', stiffness: 420, damping: 22, mass: 0.8 } as Transition,
} as const

// ─── Motion Variants ─────────────────────────────────────────────────────────
// Semantic variant sets used across the component library.

export const variants = {
  /**
   * Button interaction. Use with:
   *   whileHover="hovered"  whileTap="pressed"
   * y: 1 on press = physical depth (makes click feel real, not flat).
   * Opacity layering stops UI feeling flat on interaction.
   */
  interactive: {
    rest:    { scale: 1,     y: 0, opacity: 1    },
    hovered: { scale: 1.015, y: 0, opacity: 0.98 },
    pressed: { scale: 0.97,  y: 1, opacity: 0.95 },
  },

  /** Modal / Dialog entrance + exit. */
  modal: {
    hidden:  { opacity: 0, scale: 0.96, y: 8 },
    visible: { opacity: 1, scale: 1,    y: 0 },
    exit:    { opacity: 0, scale: 0.96, y: 4 },
  },

  /** Dropdown / Popover entrance (drops down from trigger). */
  dropdown: {
    hidden:  { opacity: 0, y: -6,  scale: 0.98 },
    visible: { opacity: 1, y: 0,   scale: 1    },
    exit:    { opacity: 0, y: -4,  scale: 0.98 },
  },

  /** Sheet entrance from bottom. Combine with directional x/y as needed. */
  slideUp: {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0  },
    exit:    { opacity: 0, y: 8  },
  },

  /** Fade only. Overlays, backgrounds. */
  fade: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
    exit:    { opacity: 0 },
  },
} as const
```

- [ ] **Step 2: Create MotionProvider.tsx**

Create `packages/ui/src/MotionProvider.tsx`:

```tsx
'use client'

import React from 'react'

/**
 * MotionProvider — wrap your app root with this once.
 * Framer Motion detects prefers-reduced-motion automatically and
 * sets all animation durations to ~0ms when active.
 * This provider is a semantic boundary; add global animation config here if needed.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 3: Export from index.ts**

In `packages/ui/src/index.ts`, add these two lines at the end of the file (after the existing exports):

```ts
export * from './animations'
export * from './MotionProvider'
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to the new files).

- [ ] **Step 5: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/animations.ts packages/ui/src/MotionProvider.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add animations.ts spring presets + MotionProvider"
```

---

## Task 2: Button — Spring Tap + Hover + Depth

**Files:**
- Modify: `packages/ui/src/components/ui/Button.tsx`

The current Button uses CSS `active:scale-95` (CSS, not spring). Replace with `motion.button` and spring physics.

- [ ] **Step 1: Update Button.tsx**

Replace the entire file at `packages/ui/src/components/ui/Button.tsx`:

```tsx
'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { spring, variants } from '../../animations';

const buttonVariants = cva(
  'magnetic-btn inline-flex items-center justify-center whitespace-nowrap rounded-full disabled:pointer-events-none disabled:opacity-50 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:     'bg-[var(--theme-accent)] text-white hover:opacity-90',
        secondary:   'bg-[var(--theme-primary)] text-white hover:opacity-90',
        ghost:       'bg-transparent hover:bg-black/5 dark:hover:bg-white/5',
        outline:     'bg-transparent border border-[var(--theme-accent)] text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-white',
        destructive: 'bg-[var(--theme-destructive)] text-white hover:opacity-90',
        link:        'text-[var(--theme-accent)] underline-offset-4 hover:underline',
        default:     'bg-[var(--theme-accent)] text-white hover:opacity-90',
      },
      size: {
        sm:      'px-3 py-1.5 text-sm',
        md:      'px-6 py-3 text-base',
        lg:      'px-8 py-4 text-lg font-bold',
        default: 'px-6 py-3 text-base',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const MotionButton = motion.button;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    // asChild uses Slot (not motion) — skip animation for render-as-child pattern
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <MotionButton
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        initial="rest"
        whileHover="hovered"
        whileTap="pressed"
        variants={variants.interactive}
        transition={spring.snappy}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {children}
          </span>
        ) : children}
      </MotionButton>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 2: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/Button.tsx
git commit -m "feat(ui): Button — spring tap/hover with depth (y:1) and opacity layering"
```

---

## Task 3: Dialog + AlertDialog — Spring Entrance

**Files:**
- Modify: `packages/ui/src/components/ui/Dialog.tsx`
- Modify: `packages/ui/src/components/ui/AlertDialog.tsx`

**Approach:** Use `motion(DialogPrimitive.Content)` to create a motion-aware Radix Content. This gives spring entrance. Exit uses fast CSS fade (Radix unmounts on close — exit spring requires `forceMount` which changes the API; fast CSS is the right trade-off here).

- [ ] **Step 1: Update Dialog.tsx**

Replace `packages/ui/src/components/ui/Dialog.tsx` with:

```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { spring, variants } from "../../animations"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// motion-enhanced Radix Content — inherits all Radix accessibility + spring animations
const MotionContent = motion(DialogPrimitive.Content)

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <MotionContent
      ref={ref}
      initial={variants.modal.hidden}
      animate={variants.modal.visible}
      transition={spring.smooth}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-lg sm:rounded-lg",
        // Keep fast CSS exit (Radix unmounts on close — spring exit needs forceMount which changes the API)
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-[var(--theme-background)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)] focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </MotionContent>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-[var(--theme-text-muted)]", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
```

- [ ] **Step 2: Update AlertDialog.tsx**

Replace `packages/ui/src/components/ui/AlertDialog.tsx` with:

```tsx
"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./Button"
import { spring, variants } from "../../animations"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const MotionContent = motion(AlertDialogPrimitive.Content)

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <MotionContent
      ref={ref}
      initial={variants.modal.hidden}
      animate={variants.modal.visible}
      transition={spring.smooth}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-lg sm:rounded-lg",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-[var(--theme-text-muted)]", className)} {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "ghost" }), "mt-2 sm:mt-0", className)} {...props} />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger,
  AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/Dialog.tsx packages/ui/src/components/ui/AlertDialog.tsx
git commit -m "feat(ui): Dialog + AlertDialog — spring entrance via motion(Primitive)"
```

---

## Task 4: Sheet — Directional Spring Slide

**Files:**
- Modify: `packages/ui/src/components/ui/Sheet.tsx`

Sheet slides in from an edge. We animate `x` or `y` with spring to replace the CSS `slide-in-from-*` classes.

- [ ] **Step 1: Update Sheet.tsx**

Replace `packages/ui/src/components/ui/Sheet.tsx` with:

```tsx
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { spring } from "../../animations"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

// Spring initial positions per side
const slideInitial: Record<string, object> = {
  top:    { y: '-100%', opacity: 0 },
  bottom: { y:  '100%', opacity: 0 },
  left:   { x: '-100%', opacity: 0 },
  right:  { x:  '100%', opacity: 0 },
}
const slideAnimate = { x: 0, y: 0, opacity: 1 }

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-[var(--theme-background)] p-6 shadow-lg data-[state=closed]:animate-out data-[state=closed]:duration-200",
  {
    variants: {
      side: {
        top:    "inset-x-0 top-0 border-b border-[var(--theme-border)] data-[state=closed]:slide-out-to-top",
        bottom: "inset-x-0 bottom-0 border-t border-[var(--theme-border)] data-[state=closed]:slide-out-to-bottom",
        left:   "inset-y-0 left-0 h-full w-3/4 border-r border-[var(--theme-border)] data-[state=closed]:slide-out-to-left sm:max-w-sm",
        right:  "inset-y-0 right-0 h-full w-3/4 border-l border-[var(--theme-border)] data-[state=closed]:slide-out-to-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const MotionSheetContent = motion(SheetPrimitive.Content)

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <MotionSheetContent
      ref={ref}
      initial={slideInitial[side ?? 'right']}
      animate={slideAnimate}
      transition={spring.smooth}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-[var(--theme-background)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)] focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetClose>
    </MotionSheetContent>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-[var(--theme-text)]", className)} {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-[var(--theme-text-muted)]", className)} {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
```

- [ ] **Step 2: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/Sheet.tsx
git commit -m "feat(ui): Sheet — directional spring slide entrance"
```

---

## Task 5: DropdownMenu + Dropdown — Spring Entrance

**Files:**
- Modify: `packages/ui/src/components/ui/DropdownMenu.tsx`
- Modify: `packages/ui/src/components/ui/Dropdown.tsx`

- [ ] **Step 1: Update DropdownMenu.tsx — add spring entrance to DropdownMenuContent**

Read the current file first, then find `DropdownMenuContent` and replace just that component. The full file is large so we surgically replace only the content component.

Open `packages/ui/src/components/ui/DropdownMenu.tsx`. Find the `DropdownMenuContent` forwardRef block (it starts with `const DropdownMenuContent = React.forwardRef`). Replace it with:

```tsx
const MotionDropdownContent = motion(DropdownMenuPrimitive.Content)

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <MotionDropdownContent
      ref={ref}
      sideOffset={sideOffset}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ ...spring.snappy }}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-1 text-[var(--theme-text)] shadow-cinematic",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName
```

Also add at the top of the file (after existing imports):
```tsx
import { motion } from "framer-motion"
import { spring } from "../../animations"
```

- [ ] **Step 2: Update Dropdown.tsx — align existing spring to presets**

In `packages/ui/src/components/ui/Dropdown.tsx`, find the `motion.div` with `transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}` and replace with:

```tsx
// Old:
transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
// New:
transition={{ ...spring.snappy }}
```

Also update the `initial/animate/exit` values to match the dropdown variant:
```tsx
// Old:
initial={{ opacity: 0, y: 10, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 10, scale: 0.95 }}
// New:
initial={{ opacity: 0, y: -6, scale: 0.98 }}
animate={{ opacity: 1, y: 0,  scale: 1    }}
exit={{ opacity: 0,   y: -4,  scale: 0.98 }}
```

And add the `spring` import at the top:
```tsx
import { spring } from "../../animations"
```

- [ ] **Step 3: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/DropdownMenu.tsx packages/ui/src/components/ui/Dropdown.tsx
git commit -m "feat(ui): DropdownMenu + Dropdown — spring entrance via animations.ts presets"
```

---

## Task 6: Toast — Full AnimatePresence

**Files:**
- Modify: `packages/ui/src/components/ui/Toast.tsx`

Toast state is owned by us (not Radix), so we can use full `AnimatePresence` with proper exit animations.

- [ ] **Step 1: Replace Toast.tsx**

Replace `packages/ui/src/components/ui/Toast.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Check, X, Info } from 'lucide-react';
import { spring, variants } from '../../animations';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

let _id = 0;
let _set: ((fn: (prev: ToastItem[]) => ToastItem[]) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  if (!_set) return;
  const id = ++_id;
  _set(prev => [...prev, { id, message, type }]);
  setTimeout(() => _set?.(prev => prev.filter(t => t.id !== id)), 3500);
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => { _set = setToasts; return () => { _set = null; }; }, []);

  return (
    <div className="fixed bottom-12 right-12 z-[100] flex flex-col gap-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={variants.slideUp.hidden}
            animate={variants.slideUp.visible}
            exit={variants.slideUp.exit}
            transition={spring.smooth}
            className={cn(
              "flex items-center gap-4 px-6 py-4 rounded-3xl shadow-cinematic border backdrop-blur-3xl",
              t.type === 'success' ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20 text-[var(--theme-accent)]' :
              t.type === 'error'   ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                   'bg-blue-500/10 border-blue-500/20 text-blue-500'
            )}
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full shadow-sm shrink-0",
              t.type === 'success' ? 'bg-[var(--theme-accent)] text-white' :
              t.type === 'error'   ? 'bg-red-500 text-white' :
                                   'bg-blue-500 text-white'
            )}>
              {t.type === 'success' ? <Check className="h-4 w-4" /> : t.type === 'error' ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </div>
            <span className="text-base font-medium tracking-tight">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

Key changes:
- `AnimatePresence mode="popLayout"` — new toasts push existing ones smoothly (layout-aware)
- `layout` prop on each toast — toasts reposition with spring when one is dismissed
- `slideUp` variant with `spring.smooth` for enter/exit

- [ ] **Step 2: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/Toast.tsx
git commit -m "feat(ui): Toast — full AnimatePresence with layout-aware popLayout mode"
```

---

## Task 7: Switch + Checkbox — Spring State Animations

**Files:**
- Modify: `packages/ui/src/components/ui/Switch.tsx`
- Modify: `packages/ui/src/components/ui/Checkbox.tsx`

- [ ] **Step 1: Replace Switch.tsx**

Replace `packages/ui/src/components/ui/Switch.tsx` with:

```tsx
'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { spring } from '../../animations'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked: controlledChecked, defaultChecked = false, onCheckedChange, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked)
  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked

  const handleChange = (val: boolean) => {
    if (controlledChecked === undefined) setInternalChecked(val)
    onCheckedChange?.(val)
  }

  return (
    <SwitchPrimitives.Root
      ref={ref}
      checked={isChecked}
      onCheckedChange={handleChange}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-background)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--theme-accent)] data-[state=unchecked]:bg-[var(--theme-border)]',
        className
      )}
      {...props}
    >
      {/* motion.span replaces SwitchPrimitives.Thumb — spring x animation instead of CSS translate */}
      <motion.span
        className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0"
        animate={{ x: isChecked ? 20 : 0 }}
        transition={spring.snappy}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

- [ ] **Step 2: Replace Checkbox.tsx**

Replace `packages/ui/src/components/ui/Checkbox.tsx` with:

```tsx
'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { spring } from '../../animations';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-5 w-5 shrink-0 rounded-sm border border-[var(--theme-border)] shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--theme-accent)] data-[state=checked]:text-white data-[state=checked]:border-[var(--theme-accent)] transition-colors bg-white dark:bg-white/5',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {/* AnimatePresence: Indicator only renders when checked — bounce in/out */}
      <AnimatePresence>
        <motion.span
          key="check"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={spring.bounce}
        >
          <Check className="h-4 w-4" />
        </motion.span>
      </AnimatePresence>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
```

- [ ] **Step 3: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/Switch.tsx packages/ui/src/components/ui/Checkbox.tsx
git commit -m "feat(ui): Switch spring thumb + Checkbox bounce tick"
```

---

## Task 8: Popover, Card, StatsCard, ThemeToggleButton, Progress

**Files:**
- Modify: `packages/ui/src/components/ui/Popover.tsx`
- Modify: `packages/ui/src/components/ui/Card.tsx`
- Modify: `packages/ui/src/components/ui/StatsCard.tsx`
- Modify: `packages/ui/src/components/ui/ThemeToggleButton.tsx`
- Modify: `packages/ui/src/components/ui/Progress.tsx`

- [ ] **Step 1: Update Popover.tsx**

Replace `packages/ui/src/components/ui/Popover.tsx` with:

```tsx
'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { spring, variants } from '../../animations';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

const MotionPopoverContent = motion(PopoverPrimitive.Content)

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <MotionPopoverContent
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      initial={{ opacity: 0, scale: 0.97, y: -4 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      transition={spring.snappy}
      className={cn(
        'z-50 w-72 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-cinematic outline-none backdrop-blur-3xl',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';
```

- [ ] **Step 2: Update Card.tsx**

In `packages/ui/src/components/ui/Card.tsx`, add `motion` import and replace `<div ref={ref}` with `<motion.div ref={ref}` plus `whileHover` and `transition`. Find the return statement in the `Card` component and replace:

```tsx
// Add imports at top of file:
import { motion } from 'framer-motion';
import { spring } from '../../animations';

// In the Card component, replace:
return (
  <div
    ref={ref}
    className={cn("rounded-3xl transition-all duration-500", variants[variant], paddings[padding], className)}
    {...props}
  >
    {children}
  </div>
)

// With:
return (
  <motion.div
    ref={ref}
    className={cn("rounded-3xl", variants[variant], paddings[padding], className)}
    whileHover={{ y: -2 }}
    transition={spring.smooth}
    {...props}
  >
    {children}
  </motion.div>
)
```

Note: remove the `transition-all duration-500` Tailwind class since Framer Motion now owns the transition.

- [ ] **Step 3: Update StatsCard.tsx**

In `packages/ui/src/components/ui/StatsCard.tsx`, wrap the `Card` in a `motion.div`:

Add imports at top:
```tsx
import { motion } from 'framer-motion';
import { spring } from '../../animations';
```

Wrap the return in a `motion.div`:
```tsx
export function StatsCard({ label, value, icon: Icon, className }: StatsCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={spring.smooth}>
      <Card className={cn("border-[var(--theme-border)]", className)}>
        <CardContent className="p-8 space-y-1">
          <div className="text-[10px] font-mono font-bold text-[var(--theme-text-dim)] uppercase tracking-[0.2em] flex items-center gap-2">
            {Icon && <Icon size={12} className="text-[var(--theme-accent)]" />}
            {label}
          </div>
          <div className="text-lg font-bold text-[var(--theme-text)] truncate">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

- [ ] **Step 4: Update ThemeToggleButton.tsx**

Replace `packages/ui/src/components/ui/ThemeToggleButton.tsx` with:

```tsx
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';
import { spring } from '../../animations';

export function ThemeToggleButton({ className }: { className?: string }) {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className={cn(
        "relative p-2 rounded-full border overflow-hidden group",
        "bg-white/5 border-black/5 hover:bg-black/[0.02] dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/[0.08]",
        className
      )}
      aria-label="Toggle theme"
    >
      <div className="relative h-5 w-5">
        <AnimatePresence mode="wait" initial={false}>
          {isDarkMode ? (
            <motion.span
              key="moon"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0,   scale: 1, opacity: 1 }}
              exit={{    rotate:  90, scale: 0, opacity: 0 }}
              transition={spring.snappy}
            >
              <Moon className="h-5 w-5 text-blue-400" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ rotate:  90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0,   scale: 1, opacity: 1 }}
              exit={{    rotate: -90, scale: 0, opacity: 0 }}
              transition={spring.snappy}
            >
              <Sun className="h-5 w-5 text-amber-500" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {/* Cinematic glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
```

- [ ] **Step 5: Update Progress.tsx**

Replace `packages/ui/src/components/ui/Progress.tsx` with:

```tsx
import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { spring } from '../../animations'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))
    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-[var(--theme-border)]', className)}
        {...props}
      >
        <motion.div
          className="h-full bg-[var(--theme-accent)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={spring.smooth}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
```

- [ ] **Step 6: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
cd /opt/relentify-monorepo
git add \
  packages/ui/src/components/ui/Popover.tsx \
  packages/ui/src/components/ui/Card.tsx \
  packages/ui/src/components/ui/StatsCard.tsx \
  packages/ui/src/components/ui/ThemeToggleButton.tsx \
  packages/ui/src/components/ui/Progress.tsx
git commit -m "feat(ui): Popover/Card/StatsCard spring hover, ThemeToggle spring icon swap, Progress animated width"
```

---

## Task 9: 22accounting — MotionProvider + Page Transitions + Form Shake

**Files:**
- Modify: `apps/22accounting/app/dashboard/layout.tsx`
- Create: `apps/22accounting/src/components/layout/PageTransition.tsx`

- [ ] **Step 1: Create PageTransition component**

Create `apps/22accounting/src/components/layout/PageTransition.tsx`:

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { spring } from '@relentify/ui';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0  },
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="hidden"
        animate="visible"
        variants={pageVariants}
        transition={spring.gentle}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Update dashboard layout.tsx to add MotionProvider + PageTransition**

In `apps/22accounting/app/dashboard/layout.tsx`, add these imports at the top:

```tsx
import { MotionProvider } from '@relentify/ui';
import { PageTransition } from '@/src/components/layout/PageTransition';
```

Then in the return, wrap the entire `<NavShell>` with `<MotionProvider>`, and wrap `{children}` with `<PageTransition>`:

```tsx
// Current:
return (
  <NavShell
    topbar={...}
  >
    <>
      <AccountantBanner ... />
      {children}
    </>
  </NavShell>
)

// Replace with:
return (
  <MotionProvider>
    <NavShell
      topbar={...}
    >
      <>
        <AccountantBanner ... />
        <PageTransition>
          {children}
        </PageTransition>
      </>
    </NavShell>
  </MotionProvider>
)
```

- [ ] **Step 3: TypeScript check**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add \
  apps/22accounting/src/components/layout/PageTransition.tsx \
  apps/22accounting/app/dashboard/layout.tsx
git commit -m "feat(22accounting): MotionProvider + page transition (gentle spring slideUp)"
```

---

## Task 10: Layout Animations — TabsNav + Toast list

**Files:**
- Modify: `packages/ui/src/components/ui/Tabs.tsx`

The `TabsNav` active indicator already uses `layoutId` — update its transition spring to match `spring.snappy`. The `Toaster` now uses `layout` (done in Task 6). This task updates the Tabs spring.

- [ ] **Step 1: Update TabsNav spring in Tabs.tsx**

In `packages/ui/src/components/ui/Tabs.tsx`, add the import:
```tsx
import { spring } from '../../animations'
```

Find the `<motion.div layoutId="activeTabNav" ...>` element and update its `transition` prop:

```tsx
// Old:
transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}

// New:
transition={spring.snappy}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /opt/relentify-monorepo/packages/ui
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add packages/ui/src/components/ui/Tabs.tsx
git commit -m "feat(ui): Tabs active indicator uses spring.snappy from animations.ts"
```

---

## Task 11: Build and Verify

- [ ] **Step 1: Full TypeScript check across both packages**

```bash
cd /opt/relentify-monorepo/packages/ui && npx tsc --noEmit 2>&1 | head -40
cd /opt/relentify-monorepo/apps/22accounting && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors related to our changes. (Pre-existing errors not introduced by this work are acceptable — note them.)

- [ ] **Step 2: Build 22accounting Docker image**

```bash
cd /opt/relentify-monorepo
docker compose build --no-cache 22accounting 2>&1 | tail -30
```

Expected: build completes successfully. Watch for TypeScript or missing-module errors.

- [ ] **Step 3: Start container and confirm it's healthy**

```bash
docker compose up -d 22accounting
sleep 10
docker ps --filter name=22accounting --format "table {{.Names}}\t{{.Status}}"
docker logs 22accounting --tail 20
```

Expected: container is `Up ... (healthy)` and logs show Next.js ready message.

- [ ] **Step 4: Smoke test animations (manual)**

Open `https://accounting.relentify.com` in a browser and verify:

| Element | Expected behaviour |
|---------|-------------------|
| Any button | Press feels physical — slight downward sink, not just scale |
| Create Invoice / any modal | Opens with spring scale (not instant) |
| User menu (top right) | Dropdown slides down with spring |
| Theme toggle button | Icon rotates with spring, no CSS flash |
| Any checkbox | Tick bounces in with overshoot |
| Any switch | Thumb slides with spring (not CSS snap) |
| Navigating between pages | Gentle fade+slide transition |
| Toast (any form submission) | Slides up from bottom-right |
| Progress bars | Animate width to value on mount |

- [ ] **Step 5: Clean up Docker build cache**

```bash
docker builder prune -f
```

- [ ] **Step 6: Update CLAUDE.md with animation system details**

In `apps/22accounting/CLAUDE.md`, add under the Key Files section:

```markdown
| `packages/ui/src/animations.ts` | Spring presets (`spring.snappy/smooth/gentle/bounce`) + motion variants. Single source of truth — import here, never hardcode animation values in components. |
| `packages/ui/src/MotionProvider.tsx` | Wrap app root once. framer-motion `useReducedMotion` auto-disables animations for accessibility. |
| `apps/22accounting/src/components/layout/PageTransition.tsx` | Page-level slide+fade transition; keyed on pathname via `AnimatePresence`. |
```

- [ ] **Step 7: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/CLAUDE.md
git commit -m "docs: record animation system in CLAUDE.md"
```
