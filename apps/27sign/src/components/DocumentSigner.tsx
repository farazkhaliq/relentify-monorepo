'use client'

import { useState, useMemo, useCallback, useEffect, type RefObject } from 'react'
import { PenTool, Type, Calendar, TextCursorInput, Check } from 'lucide-react'
import DocumentViewer from './DocumentViewer'
import FieldModal from './FieldModal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignerField {
  id: string
  field_type: string
  label: string | null
  page_number: number
  x_percent: number
  y_percent: number
  width_percent: number
  height_percent: number
  value: string | null
  prefilled: boolean
}

interface DocumentSignerProps {
  pdfData: string
  pageCount: number
  fields: SignerField[]
  token: string
  sessionToken: string
  onFieldFilled: (fieldId: string, value: string) => void
  onAllFieldsFilled: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD_ICONS: Record<string, typeof PenTool> = {
  signature: PenTool,
  initials: TextCursorInput,
  date: Calendar,
  text: Type,
}

function fieldLabel(f: SignerField): string {
  if (f.label) return f.label
  switch (f.field_type) {
    case 'signature': return 'Signature'
    case 'initials': return 'Initials'
    case 'date': return 'Date'
    default: return 'Text'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentSigner({
  pdfData,
  pageCount,
  fields: initialFields,
  token,
  sessionToken,
  onFieldFilled,
  onAllFieldsFilled,
}: DocumentSignerProps) {
  const [fields, setFields] = useState<SignerField[]>(initialFields)
  const [activeField, setActiveField] = useState<SignerField | null>(null)

  const filledCount = useMemo(() => fields.filter(f => f.value !== null).length, [fields])
  const totalCount = fields.length
  const allDone = filledCount === totalCount && totalCount > 0

  // Notify parent when all fields are filled
  useEffect(() => {
    if (allDone) onAllFieldsFilled()
  }, [allDone, onAllFieldsFilled])

  const handleFieldComplete = useCallback((fieldId: string, value: string) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f))
    setActiveField(null)
    onFieldFilled(fieldId, value)
  }, [onFieldFilled])

  // ---------------------------------------------------------------------------
  // Render field overlays for a given page
  // ---------------------------------------------------------------------------
  const renderOverlays = useCallback((pageNumber: number, _pageRef: RefObject<HTMLDivElement | null>) => {
    const pageFields = fields.filter(f => f.page_number === pageNumber)
    if (pageFields.length === 0) return null

    return (
      <>
        {pageFields.map(field => {
          const Icon = FIELD_ICONS[field.field_type] || Type
          const isFilled = field.value !== null
          const isPrefilled = field.prefilled

          // Determine styling
          let borderClass: string
          let bgClass: string
          let cursor: string

          if (isPrefilled) {
            borderClass = 'border border-[var(--theme-border)]'
            bgClass = 'bg-[var(--theme-border)]/30'
            cursor = 'cursor-default'
          } else if (isFilled) {
            borderClass = 'border-2 border-[var(--theme-success)]'
            bgClass = 'bg-[var(--theme-success)]/10'
            cursor = 'cursor-pointer'
          } else {
            borderClass = 'border-2 border-amber-400'
            bgClass = 'bg-amber-400/10 animate-pulse'
            cursor = 'cursor-pointer'
          }

          const isSignatureType = field.field_type === 'signature' || field.field_type === 'initials'

          return (
            <div
              key={field.id}
              className={`absolute flex items-center justify-center gap-1 rounded-md transition-all ${borderClass} ${bgClass} ${cursor}`}
              style={{
                left: `${field.x_percent}%`,
                top: `${field.y_percent}%`,
                width: `${field.width_percent}%`,
                height: `${field.height_percent}%`,
                zIndex: 10,
              }}
              onClick={() => {
                if (!isPrefilled && !isFilled) setActiveField(field)
              }}
              title={fieldLabel(field)}
            >
              {isFilled ? (
                // Filled state: show checkmark + thumbnail/text
                <div className="flex items-center gap-1 overflow-hidden px-1">
                  <Check className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--theme-success)' }} />
                  {isSignatureType && field.value ? (
                    <img
                      src={field.value.startsWith('data:') ? field.value : `data:image/png;base64,${field.value}`}
                      alt="Signature"
                      className="max-h-full max-w-full object-contain"
                      style={{ maxHeight: '90%' }}
                    />
                  ) : (
                    <span
                      className="truncate text-[10px] font-medium"
                      style={{ color: 'var(--theme-text)' }}
                    >
                      {field.value}
                    </span>
                  )}
                </div>
              ) : isPrefilled ? (
                // Prefilled: show value read-only
                <div className="flex items-center gap-1 overflow-hidden px-1">
                  {isSignatureType && field.value ? (
                    <img
                      src={field.value.startsWith('data:') ? field.value : `data:image/png;base64,${field.value}`}
                      alt="Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span
                      className="truncate text-[10px]"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      {field.value || fieldLabel(field)}
                    </span>
                  )}
                </div>
              ) : (
                // Unfilled: show icon + label
                <div className="flex items-center gap-1 px-1">
                  <Icon className="h-3 w-3 flex-shrink-0" style={{ color: 'rgb(251, 191, 36)' }} />
                  <span
                    className="truncate text-[10px] font-medium"
                    style={{ color: 'rgb(251, 191, 36)' }}
                  >
                    {fieldLabel(field)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }, [fields])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
            {filledCount} of {totalCount} fields completed
          </span>
          {allDone && (
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--theme-success)' }}>
              All done
            </span>
          )}
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--theme-border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: totalCount > 0 ? `${(filledCount / totalCount) * 100}%` : '0%',
              backgroundColor: allDone ? 'var(--theme-success)' : 'var(--theme-accent)',
            }}
          />
        </div>
      </div>

      {/* Document with field overlays */}
      <DocumentViewer pdfData={pdfData} pageCount={pageCount}>
        {renderOverlays}
      </DocumentViewer>

      {/* Field modal */}
      {activeField && (
        <FieldModal
          field={activeField}
          token={token}
          sessionToken={sessionToken}
          onComplete={handleFieldComplete}
          onClose={() => setActiveField(null)}
        />
      )}
    </div>
  )
}
