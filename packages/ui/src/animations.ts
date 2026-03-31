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
