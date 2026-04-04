'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`

interface PageRendererProps {
  pdfData: string           // base64 PDF data (without data: prefix)
  pageNumber: number        // 1-indexed
  scale?: number            // default 1.5
  className?: string
  unloadOffscreen?: boolean // clear canvas when scrolled out of view (default false)
  onRender?: () => void     // called after page renders
}

export default function PageRenderer({
  pdfData,
  pageNumber,
  scale = 1.5,
  className,
  unloadOffscreen = false,
  onRender,
}: PageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const prevDataRef = useRef<string>('')
  const isVisibleRef = useRef(false)
  const hasRenderedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  // Cancel any in-flight render
  const cancelRender = useCallback(() => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
      renderTaskRef.current = null
    }
  }, [])

  // Render a specific page to the canvas
  const renderPage = useCallback(async (pdf: PDFDocumentProxy, page: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    cancelRender()

    try {
      const pdfPage = await pdf.getPage(page)
      const viewport = pdfPage.getViewport({ scale })

      // Account for device pixel ratio for crisp rendering
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)

      // CSS dimensions = logical viewport size
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      setDimensions({ width: viewport.width, height: viewport.height })

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const renderTask = pdfPage.render({
        canvasContext: ctx,
        viewport,
      })
      renderTaskRef.current = renderTask

      await renderTask.promise
      renderTaskRef.current = null
      hasRenderedRef.current = true
      setLoading(false)
      setError(null)
      onRender?.()
    } catch (err: unknown) {
      // Cancelled renders are expected — don't treat as error
      if (err instanceof Error && err.message?.includes('Rendering cancelled')) return
      // pdfjs uses a custom error type with a name property
      if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') return
      setError('Failed to render page')
      setLoading(false)
    }
  }, [scale, cancelRender, onRender])

  // Clear the canvas (free GPU/memory)
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    hasRenderedRef.current = false
  }, [])

  // Load PDF document (cached — only reloads when pdfData changes)
  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      // Same data — no reload needed
      if (prevDataRef.current === pdfData && pdfDocRef.current) return
      prevDataRef.current = pdfData

      // Clean up previous document
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }

      setLoading(true)
      setError(null)

      try {
        const binaryString = atob(pdfData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const loadingTask = pdfjs.getDocument({ data: bytes })
        const pdf = await loadingTask.promise

        if (cancelled) {
          pdf.destroy()
          return
        }

        pdfDocRef.current = pdf

        // If already visible, render immediately
        if (isVisibleRef.current) {
          await renderPage(pdf, pageNumber)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load PDF')
          setLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      cancelled = true
    }
  }, [pdfData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render when pageNumber or scale changes (if visible)
  useEffect(() => {
    if (!pdfDocRef.current || !isVisibleRef.current) return
    setLoading(true)
    renderPage(pdfDocRef.current, pageNumber)
  }, [pageNumber, scale, renderPage])

  // IntersectionObserver for lazy rendering + optional offscreen unloading
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisibleRef.current
        isVisibleRef.current = entry.isIntersecting

        if (entry.isIntersecting && !wasVisible) {
          // Scrolled into view — render if we have a document and haven't rendered yet
          if (pdfDocRef.current && !hasRenderedRef.current) {
            setLoading(true)
            renderPage(pdfDocRef.current, pageNumber)
          }
        } else if (!entry.isIntersecting && wasVisible && unloadOffscreen) {
          // Scrolled out of view — clear canvas to free memory
          cancelRender()
          clearCanvas()
        }
      },
      {
        rootMargin: '200px 0px', // Start loading slightly before visible
      }
    )

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [pageNumber, unloadOffscreen, renderPage, cancelRender, clearCanvas])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRender()
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
    }
  }, [cancelRender])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: dimensions ? `${dimensions.width}px` : '100%',
        maxWidth: '100%',
      }}
    >
      {/* Loading placeholder */}
      {loading && (
        <div
          style={{
            width: dimensions ? `${dimensions.width}px` : '100%',
            height: dimensions ? `${dimensions.height}px` : '400px',
            maxWidth: '100%',
          }}
          className="flex items-center justify-center rounded-lg"
          role="status"
          aria-label={`Loading page ${pageNumber}`}
        >
          <span
            className="text-sm"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Loading page {pageNumber}...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            width: dimensions ? `${dimensions.width}px` : '100%',
            height: dimensions ? `${dimensions.height}px` : '400px',
            maxWidth: '100%',
          }}
          className="flex items-center justify-center rounded-lg"
        >
          <span
            className="text-sm"
            style={{ color: 'var(--theme-destructive)' }}
          >
            {error}
          </span>
        </div>
      )}

      {/* Canvas — always in DOM for ref stability, hidden when loading/error */}
      <canvas
        ref={canvasRef}
        style={{
          display: loading || error ? 'none' : 'block',
          maxWidth: '100%',
          height: 'auto',
        }}
      />
    </div>
  )
}
