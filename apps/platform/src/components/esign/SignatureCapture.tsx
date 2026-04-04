'use client'

import { useState, useEffect } from 'react'
import DrawPad from './DrawPad'
import UploadSignature from './UploadSignature'
import SavedSignatures from './SavedSignatures'

interface Props {
  token: string
  onSignatureChange: (data: string | null, source: 'draw' | 'upload' | 'saved') => void
}

const TABS = ['Draw', 'Upload', 'Saved'] as const

export default function SignatureCapture({ token, onSignatureChange }: Props) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Draw')
  const [savedSignatures, setSavedSignatures] = useState<Array<{ id: string; imageData: string; source: string }>>([])
  const [hasSaved, setHasSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/esign/sign/${token}/saved-signatures`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.signatures?.length > 0) {
          setSavedSignatures(data.signatures)
          setHasSaved(true)
        }
      })
      .catch(() => {})
  }, [token])

  const tabs = hasSaved ? TABS : TABS.filter(t => t !== 'Saved')

  return (
    <div className="space-y-4">
      {/* Tab buttons */}
      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); onSignatureChange(null, 'draw') }}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === tab
                ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] shadow-lg shadow-[var(--theme-accent)]/20'
                : 'bg-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Draw' && (
        <DrawPad onSignatureChange={(data) => onSignatureChange(data, 'draw')} />
      )}
      {activeTab === 'Upload' && (
        <UploadSignature onSignatureChange={(data) => onSignatureChange(data, 'upload')} />
      )}
      {activeTab === 'Saved' && (
        <SavedSignatures
          signatures={savedSignatures}
          onSelect={(data) => onSignatureChange(data, 'saved')}
        />
      )}
    </div>
  )
}
