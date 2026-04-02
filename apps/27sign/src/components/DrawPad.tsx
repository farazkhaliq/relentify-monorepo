'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'
import { Eraser, Undo2 } from 'lucide-react'

interface Props {
  onSignatureChange: (data: string | null) => void
}

export default function DrawPad({ onSignatureChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = containerRef.current
      if (!container) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = container.offsetWidth * ratio
      canvas.height = 200 * ratio
      canvas.style.width = container.offsetWidth + 'px'
      canvas.style.height = '200px'
      canvas.getContext('2d')?.scale(ratio, ratio)
      if (padRef.current) {
        padRef.current.clear()
        setIsEmpty(true)
        onSignatureChange(null)
      }
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255, 255, 255, 0)',
      penColor: '#000',
      minWidth: 1,
      maxWidth: 3,
    })

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty())
      if (!pad.isEmpty()) {
        onSignatureChange(pad.toDataURL('image/png'))
      }
    })

    padRef.current = pad
    resizeCanvas()

    window.addEventListener('resize', resizeCanvas)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      pad.off()
    }
  }, [onSignatureChange])

  function clear() {
    padRef.current?.clear()
    setIsEmpty(true)
    onSignatureChange(null)
  }

  function undo() {
    if (!padRef.current) return
    const data = padRef.current.toData()
    if (data.length > 0) {
      data.pop()
      padRef.current.fromData(data)
      const empty = padRef.current.isEmpty()
      setIsEmpty(empty)
      onSignatureChange(empty ? null : padRef.current.toDataURL('image/png'))
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative rounded-xl border-2 border-dashed border-[var(--theme-border)] bg-white overflow-hidden"
      >
        <canvas ref={canvasRef} className="touch-none" />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 font-mono text-sm uppercase tracking-widest">Sign here</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={undo}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--theme-border)] text-[var(--theme-text-muted)] text-xs font-bold uppercase tracking-widest hover:text-[var(--theme-text)] transition-colors"
        >
          <Undo2 size={12} /> Undo
        </button>
        <button
          onClick={clear}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--theme-border)] text-[var(--theme-text-muted)] text-xs font-bold uppercase tracking-widest hover:text-[var(--theme-text)] transition-colors"
        >
          <Eraser size={12} /> Clear
        </button>
      </div>
    </div>
  )
}
