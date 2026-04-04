'use client'

import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { helpUrlMap } from '@/app/lib/help-urls'

const HELP_BASE = 'https://help.relentify.com'

export function HelpButton() {
  const pathname = usePathname()
  const articlePath = helpUrlMap[pathname] ?? '/'

  return (
    <a
      href={`${HELP_BASE}${articlePath}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open help documentation"
      title="Help"
      className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-card)] transition-colors"
    >
      <HelpCircle size={16} />
    </a>
  )
}
