'use client'

import { useRef, createRef, type RefObject } from 'react'
import PageRenderer from './PageRenderer'

interface DocumentViewerProps {
  pdfData: string              // base64 PDF
  pageCount: number
  scale?: number               // default 1.0
  children?: (pageNumber: number, pageRef: RefObject<HTMLDivElement | null>) => React.ReactNode
  className?: string
}

export default function DocumentViewer({
  pdfData,
  pageCount,
  scale = 1.0,
  children,
  className,
}: DocumentViewerProps) {
  // Create stable refs for each page container
  const pageRefs = useRef<RefObject<HTMLDivElement | null>[]>([])
  if (pageRefs.current.length !== pageCount) {
    pageRefs.current = Array.from({ length: pageCount }, () => createRef<HTMLDivElement>())
  }

  return (
    <div
      className={`overflow-auto ${className ?? ''}`}
      style={{ maxHeight: '80vh' }}
    >
      <div className="flex flex-col items-center gap-2 py-4">
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNumber = i + 1
          const pageRef = pageRefs.current[i]

          return (
            <div key={pageNumber} className="flex flex-col items-center gap-1">
              {/* Page number indicator */}
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Page {pageNumber} of {pageCount}
              </span>

              {/* Page container: relative so overlay children can position absolutely */}
              <div
                ref={pageRef}
                className="relative shadow-md"
                style={{
                  border: '1px solid var(--theme-border)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <PageRenderer
                  pdfData={pdfData}
                  pageNumber={pageNumber}
                  scale={scale}
                  unloadOffscreen={true}
                />

                {/* Overlay slot for field placer or other annotations */}
                {children?.(pageNumber, pageRef)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
