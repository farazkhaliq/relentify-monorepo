'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useIsMobile } from '../../hooks/useIsMobile'
import { spring } from '../../animations'

export interface BottomTabBarItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

export interface BottomTabBarProps {
  items: BottomTabBarItem[]
  activeHref: string
}

export function BottomTabBar({ items, activeHref }: BottomTabBarProps) {
  const isMobile = useIsMobile()

  if (!isMobile) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--theme-card)] border-t border-[var(--theme-border)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const isActive = activeHref === item.href || activeHref.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full no-underline relative"
            >
              <motion.div
                className="flex flex-col items-center gap-0.5"
                initial="rest"
                whileTap="pressed"
                variants={{
                  rest: { scale: 1 },
                  pressed: { scale: 0.9 },
                }}
                transition={spring.snappy}
              >
                <div className="relative">
                  <span className={isActive ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'}>
                    {item.icon}
                  </span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--theme-destructive)] text-white text-[10px] font-semibold leading-none">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'
                  }`}
                >
                  {item.label}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
