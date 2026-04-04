'use client'

import { useState, useCallback, useRef, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { PenTool, Type, Calendar, TextCursorInput, X, ChevronDown } from 'lucide-react'
import DocumentViewer from './DocumentViewer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacedField {
  id: string
  fieldType: 'signature' | 'initials' | 'date' | 'text'
  signerEmail: string
  label: string
  pageNumber: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  prefilled: boolean
  value?: string
}

interface FieldPlacerProps {
  pdfData: string
  pageCount: number
  signers: Array<{ email: string; name?: string; color: string }>
  fields: PlacedField[]
  onFieldsChange: (fields: PlacedField[]) => void
}

type FieldType = PlacedField['fieldType']

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_DEFAULTS: Record<FieldType, { width: number; height: number; label: string }> = {
  signature: { width: 25, height: 8, label: 'Signature' },
  initials: { width: 12, height: 6, label: 'Initials' },
  date: { width: 20, height: 4, label: 'Date' },
  text: { width: 30, height: 4, label: 'Text' },
}

const FIELD_ICONS: Record<FieldType, typeof PenTool> = {
  signature: PenTool,
  initials: Type,
  date: Calendar,
  text: TextCursorInput,
}

const ASPECT_LOCKED: Record<FieldType, boolean> = {
  signature: true,
  initials: true,
  date: false,
  text: false,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Snap value to nearest 0.5% increment */
function snap(value: number): number {
  return Math.round(value * 2) / 2
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Get mouse position as percentage of element dimensions */
function toPercent(
  e: ReactPointerEvent | globalThis.PointerEvent,
  container: HTMLElement,
): { x: number; y: number } {
  const rect = container.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  }
}

// ---------------------------------------------------------------------------
// Component: Toolbar
// ---------------------------------------------------------------------------

function Toolbar({
  activeTool,
  onToolChange,
}: {
  activeTool: FieldType | null
  onToolChange: (tool: FieldType | null) => void
}) {
  const tools: FieldType[] = ['signature', 'initials', 'date', 'text']

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tools.map((tool) => {
        const Icon = FIELD_ICONS[tool]
        const isActive = activeTool === tool
        return (
          <button
            key={tool}
            type="button"
            onClick={() => onToolChange(isActive ? null : tool)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors select-none"
            style={{
              backgroundColor: isActive ? 'var(--theme-accent)' : 'var(--theme-border)',
              color: isActive ? 'white' : 'var(--theme-text-muted)',
            }}
          >
            <Icon size={14} />
            {FIELD_DEFAULTS[tool].label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component: SignerDropdown
// ---------------------------------------------------------------------------

function SignerDropdown({
  signers,
  currentEmail,
  onSelect,
  onClose,
}: {
  signers: FieldPlacerProps['signers']
  currentEmail: string
  onSelect: (email: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute z-50 rounded shadow-lg py-1 text-xs min-w-[160px]"
      style={{
        backgroundColor: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        top: '100%',
        left: 0,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {signers.map((s) => (
        <button
          key={s.email}
          type="button"
          className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors"
          style={{
            color: s.email === currentEmail ? 'var(--theme-text)' : 'var(--theme-text-muted)',
            backgroundColor: s.email === currentEmail ? 'var(--theme-border)' : 'transparent',
          }}
          onClick={() => {
            onSelect(s.email)
            onClose()
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-border)'
          }}
          onMouseLeave={(e) => {
            if (s.email !== currentEmail) {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            }
          }}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="truncate">{s.name || s.email}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component: PrefillPopover
// ---------------------------------------------------------------------------

function PrefillPopover({
  value,
  onSave,
  onClose,
}: {
  value: string
  onSave: (val: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(value)

  return (
    <div
      className="absolute z-50 rounded shadow-lg p-2 text-xs min-w-[180px]"
      style={{
        backgroundColor: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        top: '100%',
        left: 0,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="block mb-1 font-medium" style={{ color: 'var(--theme-text-muted)' }}>
        Pre-fill value
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full px-2 py-1 rounded text-xs mb-1.5"
        style={{
          backgroundColor: 'var(--theme-background)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(text); onClose() }
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className="flex justify-end gap-1">
        <button
          type="button"
          className="px-2 py-0.5 rounded text-[10px]"
          style={{ color: 'var(--theme-text-muted)' }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-2 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: 'var(--theme-accent)', color: 'white' }}
          onClick={() => { onSave(text); onClose() }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component: FieldOverlay (single field)
// ---------------------------------------------------------------------------

function FieldOverlay({
  field,
  signer,
  signers,
  onUpdate,
  onDelete,
}: {
  field: PlacedField
  signer: FieldPlacerProps['signers'][number] | undefined
  signers: FieldPlacerProps['signers']
  onUpdate: (patch: Partial<PlacedField>) => void
  onDelete: () => void
}) {
  const color = signer?.color ?? '#888'
  const Icon = FIELD_ICONS[field.fieldType]

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [showSignerMenu, setShowSignerMenu] = useState(false)
  const [showPrefill, setShowPrefill] = useState(false)

  // Refs for drag/resize tracking
  const startRef = useRef<{ x: number; y: number; fx: number; fy: number; fw: number; fh: number }>()

  // ---- Drag logic ----
  const onDragStart = useCallback(
    (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      if ((e.target as HTMLElement).closest('[data-delete-btn]')) return
      e.preventDefault()
      e.stopPropagation()

      const container = (e.currentTarget as HTMLElement).parentElement!
      const pos = toPercent(e, container)
      startRef.current = { x: pos.x, y: pos.y, fx: field.xPercent, fy: field.yPercent, fw: field.widthPercent, fh: field.heightPercent }
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [field.xPercent, field.yPercent, field.widthPercent, field.heightPercent],
  )

  const onDragMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging || !startRef.current) return
      e.preventDefault()
      const container = (e.currentTarget as HTMLElement).parentElement!
      const pos = toPercent(e, container)
      const dx = pos.x - startRef.current.x
      const dy = pos.y - startRef.current.y
      onUpdate({
        xPercent: snap(clamp(startRef.current.fx + dx, 0, 100 - field.widthPercent)),
        yPercent: snap(clamp(startRef.current.fy + dy, 0, 100 - field.heightPercent)),
      })
    },
    [dragging, field.widthPercent, field.heightPercent, onUpdate],
  )

  const onDragEnd = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging) return
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      setDragging(false)
    },
    [dragging],
  )

  // ---- Resize logic (bottom-right corner) ----
  const onResizeStart = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const fieldEl = (e.currentTarget as HTMLElement).closest('[data-field-overlay]') as HTMLElement
      const container = fieldEl.parentElement!
      const pos = toPercent(e, container)
      startRef.current = { x: pos.x, y: pos.y, fx: field.xPercent, fy: field.yPercent, fw: field.widthPercent, fh: field.heightPercent }
      setResizing(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [field.xPercent, field.yPercent, field.widthPercent, field.heightPercent],
  )

  const onResizeMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!resizing || !startRef.current) return
      e.preventDefault()
      e.stopPropagation()

      const fieldEl = (e.currentTarget as HTMLElement).closest('[data-field-overlay]') as HTMLElement
      const container = fieldEl.parentElement!
      const pos = toPercent(e, container)
      const dx = pos.x - startRef.current.x
      const dy = pos.y - startRef.current.y

      let newW = snap(clamp(startRef.current.fw + dx, 5, 100 - field.xPercent))
      let newH = snap(clamp(startRef.current.fh + dy, 2, 100 - field.yPercent))

      // Lock aspect ratio for signature/initials
      if (ASPECT_LOCKED[field.fieldType] && startRef.current.fw > 0 && startRef.current.fh > 0) {
        const ratio = startRef.current.fw / startRef.current.fh
        // Use whichever axis moved more
        if (Math.abs(dx) >= Math.abs(dy)) {
          newH = snap(clamp(newW / ratio, 2, 100 - field.yPercent))
        } else {
          newW = snap(clamp(newH * ratio, 5, 100 - field.xPercent))
        }
      }

      onUpdate({ widthPercent: newW, heightPercent: newH })
    },
    [resizing, field.fieldType, field.xPercent, field.yPercent, onUpdate],
  )

  const onResizeEnd = useCallback(
    (e: ReactPointerEvent) => {
      if (!resizing) return
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      setResizing(false)
    },
    [resizing],
  )

  // ---- Click / double-click ----
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (signers.length > 1) setShowSignerMenu((prev) => !prev)
    },
    [signers.length],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (field.fieldType === 'text' || field.fieldType === 'date') {
        setShowPrefill(true)
        setShowSignerMenu(false)
      }
    },
    [field.fieldType],
  )

  return (
    <div
      data-field-overlay
      className="absolute select-none group"
      style={{
        left: `${field.xPercent}%`,
        top: `${field.yPercent}%`,
        width: `${field.widthPercent}%`,
        height: `${field.heightPercent}%`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}1a`, // ~10% opacity hex
        borderRadius: '3px',
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: dragging || resizing ? 20 : 10,
        touchAction: 'none',
      }}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Label */}
      <div
        className="absolute inset-0 flex items-center gap-1 px-1 overflow-hidden pointer-events-none"
      >
        <Icon size={10} style={{ color, flexShrink: 0 }} />
        <span
          className="text-[10px] font-mono uppercase tracking-widest truncate"
          style={{ color }}
        >
          {field.label}
        </span>
        {field.prefilled && field.value && (
          <span
            className="text-[9px] ml-auto truncate"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            {field.value}
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        data-delete-btn
        type="button"
        className="absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text-muted)',
          zIndex: 30,
        }}
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--theme-destructive)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)'
        }}
      >
        <X size={10} />
      </button>

      {/* Signer colour dot + dropdown trigger (top-left) */}
      {signers.length > 1 && (
        <div className="absolute -top-2 -left-2 z-30">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: color, border: '2px solid var(--theme-card)' }}
          >
            <ChevronDown size={8} color="white" />
          </div>
        </div>
      )}

      {/* Signer dropdown */}
      {showSignerMenu && (
        <SignerDropdown
          signers={signers}
          currentEmail={field.signerEmail}
          onSelect={(email) => {
            const newSigner = signers.find((s) => s.email === email)
            onUpdate({ signerEmail: email, label: field.label })
            if (newSigner) onUpdate({ signerEmail: email })
          }}
          onClose={() => setShowSignerMenu(false)}
        />
      )}

      {/* Prefill popover */}
      {showPrefill && (
        <PrefillPopover
          value={field.value ?? ''}
          onSave={(val) => onUpdate({ prefilled: val.length > 0, value: val || undefined })}
          onClose={() => setShowPrefill(false)}
        />
      )}

      {/* Resize handle (bottom-right) */}
      <div
        data-resize-handle
        className="absolute -bottom-1 -right-1 w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: color,
          borderRadius: '2px',
          cursor: 'nwse-resize',
          zIndex: 30,
          touchAction: 'none',
        }}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component: FieldPlacer (main export)
// ---------------------------------------------------------------------------

export default function FieldPlacer({
  pdfData,
  pageCount,
  signers,
  fields,
  onFieldsChange,
}: FieldPlacerProps) {
  const [activeTool, setActiveTool] = useState<FieldType | null>(null)

  // Update a single field by id
  const updateField = useCallback(
    (id: string, patch: Partial<PlacedField>) => {
      onFieldsChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
    },
    [fields, onFieldsChange],
  )

  // Delete a field by id
  const deleteField = useCallback(
    (id: string) => {
      onFieldsChange(fields.filter((f) => f.id !== id))
    },
    [fields, onFieldsChange],
  )

  // Click on a page to place a new field
  const handlePageClick = useCallback(
    (e: React.MouseEvent, pageNumber: number, pageRef: RefObject<HTMLDivElement | null>) => {
      if (!activeTool) return
      const container = pageRef.current
      if (!container) return

      // Don't place if clicking on an existing field
      if ((e.target as HTMLElement).closest('[data-field-overlay]')) return

      const rect = container.getBoundingClientRect()
      const xPct = ((e.clientX - rect.left) / rect.width) * 100
      const yPct = ((e.clientY - rect.top) / rect.height) * 100

      const defaults = FIELD_DEFAULTS[activeTool]
      const defaultSigner = signers[0]

      const newField: PlacedField = {
        id: crypto.randomUUID(),
        fieldType: activeTool,
        signerEmail: defaultSigner?.email ?? '',
        label: defaults.label,
        pageNumber,
        xPercent: snap(clamp(xPct - defaults.width / 2, 0, 100 - defaults.width)),
        yPercent: snap(clamp(yPct - defaults.height / 2, 0, 100 - defaults.height)),
        widthPercent: defaults.width,
        heightPercent: defaults.height,
        prefilled: false,
      }

      onFieldsChange([...fields, newField])
    },
    [activeTool, signers, fields, onFieldsChange],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />

      {activeTool && (
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          Click on the document to place a <strong>{FIELD_DEFAULTS[activeTool].label}</strong> field.
        </p>
      )}

      {/* Document with field overlays */}
      <DocumentViewer pdfData={pdfData} pageCount={pageCount}>
        {(pageNumber, pageRef) => (
          <div
            className="absolute inset-0"
            style={{ cursor: activeTool ? 'crosshair' : 'default' }}
            onClick={(e) => handlePageClick(e, pageNumber, pageRef)}
          >
            {fields
              .filter((f) => f.pageNumber === pageNumber)
              .map((field) => (
                <FieldOverlay
                  key={field.id}
                  field={field}
                  signer={signers.find((s) => s.email === field.signerEmail)}
                  signers={signers}
                  onUpdate={(patch) => updateField(field.id, patch)}
                  onDelete={() => deleteField(field.id)}
                />
              ))}
          </div>
        )}
      </DocumentViewer>
    </div>
  )
}
