'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  signatures: Array<{ id: string; imageData: string; source: string }>
  onSelect: (data: string) => void
}

export default function SavedSignatures({ signatures, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--theme-text-muted)]">Select a previously saved signature:</p>
      <div className="grid grid-cols-2 gap-3">
        {signatures.map(sig => (
          <button
            key={sig.id}
            onClick={() => { setSelectedId(sig.id); onSelect(sig.imageData) }}
            className={`relative p-3 rounded-xl border-2 bg-white transition-all ${
              selectedId === sig.id
                ? 'border-[var(--theme-accent)] shadow-lg shadow-[var(--theme-accent)]/20'
                : 'border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
            }`}
          >
            <img src={sig.imageData} alt="Saved signature" className="max-h-16 mx-auto object-contain" />
            {selectedId === sig.id && (
              <div className="absolute top-1 right-1">
                <CheckCircle2 size={16} className="text-[var(--theme-accent)]" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
