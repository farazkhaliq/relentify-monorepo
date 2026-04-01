'use client'

import { useEffect, useRef, useState } from 'react'

interface VideoGuideProps {
  src: string
  title?: string
}

export function VideoGuide({ src, title }: VideoGuideProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="my-6 rounded-xl overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-card)]"
      style={{ minHeight: isVisible ? undefined : 200 }}
    >
      {isVisible ? (
        <video
          controls
          playsInline
          preload="metadata"
          aria-label={title ? `Video guide: ${title}` : 'Video guide'}
          className="w-full"
        >
          <source src={`/videos/${src}`} type="video/webm" />
          <p className="p-4 text-sm text-[var(--theme-text-muted)]">
            Your browser doesn&apos;t support video playback.{' '}
            <a href={`/videos/${src}`} download className="text-[var(--theme-accent)]">
              Download the video
            </a>
            .
          </p>
        </video>
      ) : (
        <div className="flex items-center justify-center h-48 text-[var(--theme-text-muted)] text-sm">
          Loading video…
        </div>
      )}
    </div>
  )
}
