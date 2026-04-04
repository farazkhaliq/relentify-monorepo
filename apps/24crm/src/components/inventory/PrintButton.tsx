'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg h-9 px-4 font-bold text-sm bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-border)] transition-colors"
    >
      🖨 Print / Save PDF
    </button>
  )
}
