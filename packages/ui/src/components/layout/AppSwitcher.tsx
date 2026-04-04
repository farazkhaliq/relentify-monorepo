'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator, Clock, Users, ClipboardList, Bell, PenTool, LayoutGrid,
} from 'lucide-react'
import { spring } from '../../animations'

const PRODUCTS = [
  { key: 'accounting', label: 'Accounting', icon: Calculator, url: 'https://accounting.relentify.com/dashboard', color: '#10B981', cta: 'Free forever', live: true },
  { key: 'timesheets', label: 'Timesheets', icon: Clock, url: 'https://timesheets.relentify.com/worker', color: '#3B82F6', cta: 'From £1/user', live: true },
  { key: 'crm', label: 'CRM', icon: Users, url: 'https://crm.relentify.com', color: '#8B5CF6', cta: 'Reserve spot', live: false },
  { key: 'inventory', label: 'Inventories', icon: ClipboardList, url: 'https://inventory.relentify.com', color: '#F59E0B', cta: 'Reserve spot', live: false },
  { key: 'reminders', label: 'Reminders', icon: Bell, url: 'https://reminders.relentify.com', color: '#EF4444', cta: 'Reserve spot', live: false },
  { key: 'esign', label: 'E-Sign', icon: PenTool, url: 'https://esign.relentify.com', color: '#06B6D4', cta: 'From £5/mo', live: false },
]

export interface AppSwitcherProps {
  currentApp: string
  userApps?: string[]
}

export function AppSwitcher({ currentApp, userApps }: AppSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [apps, setApps] = useState<string[]>(userApps || [])
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (userApps) return
    // Fetch from 21auth API, cache in sessionStorage
    const cached = sessionStorage.getItem('relentify_user_apps')
    if (cached) { setApps(JSON.parse(cached)); return }
    fetch('https://auth.relentify.com/api/user/apps', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const a = d.apps || []
        setApps(a)
        sessionStorage.setItem('relentify_user_apps', JSON.stringify(a))
      })
      .catch(() => setApps(['accounting']))
  }, [userApps])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-[var(--theme-muted)] transition-colors"
        aria-label="Switch app"
      >
        <LayoutGrid size={20} className="text-[var(--theme-text-muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={spring.snappy}
            className="absolute right-0 top-full mt-2 z-50 w-72 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl shadow-lg p-3"
          >
            <p className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2 px-1">
              Relentify Apps
            </p>
            <div className="grid grid-cols-3 gap-1">
              {PRODUCTS.map(product => {
                const Icon = product.icon
                const isCurrent = product.key === currentApp
                const hasAccess = apps.includes(product.key)

                return (
                  <a
                    key={product.key}
                    href={hasAccess ? product.url : `https://relentify.com/${product.key}`}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg no-underline transition-colors ${
                      isCurrent
                        ? 'bg-[var(--theme-accent)]/10'
                        : 'hover:bg-[var(--theme-muted)]'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: product.color + '18' }}
                    >
                      <Icon size={20} style={{ color: product.color }} />
                    </div>
                    <span className={`text-[11px] font-medium text-center leading-tight ${
                      isCurrent ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text)]'
                    }`}>
                      {product.label}
                    </span>
                    {!hasAccess && (
                      <span className="text-[9px] text-[var(--theme-text-muted)]">{product.cta}</span>
                    )}
                  </a>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
