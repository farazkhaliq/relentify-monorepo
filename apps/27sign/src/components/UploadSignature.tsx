'use client'

import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'

interface Props {
  onSignatureChange: (data: string | null) => void
}

export default function UploadSignature({ onSignatureChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPreview(result)
      onSignatureChange(result)
    }
    reader.readAsDataURL(file)
  }

  function clear() {
    setPreview(null)
    onSignatureChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative rounded-xl border border-[var(--theme-border)] bg-white p-4 flex items-center justify-center">
          <img src={preview} alt="Uploaded signature" className="max-h-40 object-contain" />
          <button
            onClick={clear}
            className="absolute top-2 right-2 p-1 rounded-full bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-[var(--theme-border)] cursor-pointer hover:border-[var(--theme-accent)] transition-colors">
          <Upload size={24} className="text-[var(--theme-text-muted)]" />
          <p className="text-sm text-[var(--theme-text-muted)]">
            Tap to upload or take a photo
          </p>
          <p className="text-xs text-[var(--theme-text-dim)]">PNG, JPG</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}
    </div>
  )
}
