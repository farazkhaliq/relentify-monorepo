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
