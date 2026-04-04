'use client'

import { Search } from 'lucide-react'

interface SessionFiltersProps {
  status: string
  search: string
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
}

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export default function SessionFilters({ status, search, onStatusChange, onSearchChange }: SessionFiltersProps) {
  return (
    <div className="p-3 border-b border-[var(--theme-border)] space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
        <input
          type="text"
          placeholder="Search visitors..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] outline-none focus:border-[var(--theme-primary)]"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              status === s.value
                ? 'bg-[var(--theme-primary)] text-white'
                : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
