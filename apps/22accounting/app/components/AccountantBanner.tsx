'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  actorId: string
  isAccountantAccess: boolean
}

export default function AccountantBanner({ actorId, isAccountantAccess }: Props) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  if (!isAccountantAccess) return null

  async function handleReturn() {
    setLeaving(true)
    await fetch('/api/accountant/switch', { method: 'DELETE', credentials: 'include' })
    router.push('/dashboard/accountant')
  }

  return (
    <div className="bg-[var(--theme-warning)]/10 border-b border-[var(--theme-warning)]/30 px-6 py-2 flex items-center justify-between">
      <p className="text-xs text-[var(--theme-warning)] font-black uppercase tracking-widest">
        Viewing as accountant
      </p>
      <button
        onClick={handleReturn}
        disabled={leaving}
        className="text-xs text-[var(--theme-warning)] underline font-medium disabled:opacity-50"
      >
        {leaving ? 'Returning…' : 'Return to my portal'}
      </button>
    </div>
  )
}
