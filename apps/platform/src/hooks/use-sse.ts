'use client'

import { useEffect, useRef, useCallback } from 'react'

type EventHandler = (data: any) => void

interface UseSSEOptions {
  url: string | null
  events: Record<string, EventHandler>
  onError?: () => void
}

export function useSSE({ url, events, onError }: UseSSEOptions) {
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!url) return
    if (esRef.current) { esRef.current.close(); esRef.current = null }

    const es = new EventSource(url)
    esRef.current = es

    for (const [event, handler] of Object.entries(events)) {
      es.addEventListener(event, (e: any) => {
        try { handler(JSON.parse(e.data)) } catch {}
      })
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      onError?.()
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000)
    }
  }, [url, events, onError])

  useEffect(() => {
    connect()
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [url]) // reconnect when url changes

  return {
    close: () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    },
  }
}
