'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: Record<string, unknown>) => void
      init: (key: string, opts: Record<string, unknown>) => void
    }
  }
}

export function Analytics() {
  const pathname = usePathname()
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com'

  useEffect(() => {
    if (!key) return
    const script = document.createElement('script')
    script.src = `${host}/static/array.js`
    script.async = true
    script.onload = () => {
      window.posthog?.init(key, { api_host: host, autocapture: false, capture_pageview: false })
    }
    document.head.appendChild(script)
  }, [key, host])

  useEffect(() => {
    if (!window.posthog) return
    window.posthog.capture('$pageview', { $current_url: window.location.href })
  }, [pathname])

  return null
}
