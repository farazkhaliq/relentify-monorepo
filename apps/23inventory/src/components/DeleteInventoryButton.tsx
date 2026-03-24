'use client'
import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@relentify/ui'
import { useDeleteInventory } from '@/hooks/useDeleteInventory'

export default function DeleteInventoryButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const { loading, deleteInventory } = useDeleteInventory(id)

  const handleDelete = async () => {
    const success = await deleteInventory()
    if (success) setOpen(false)
  }

  if (open) {
    return (
      <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
        <Button 
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
          className="h-8 rounded-lg bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/20 font-mono text-[var(--theme-text-10)] uppercase tracking-widest px-3"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Delete'}
        </Button>
        <button 
          onClick={() => setOpen(false)}
          className="h-8 w-8 p-0 rounded-lg text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)] flex items-center justify-center transition-colors"
        >
          <AlertTriangle size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        setOpen(true)
      }}
      className="h-8 w-8 p-0 rounded-lg text-[var(--theme-text-dim)] hover:text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/5 flex items-center justify-center transition-colors"
      title="Delete Record"
    >
      <Trash2 size={16} />
    </button>
  )
}
