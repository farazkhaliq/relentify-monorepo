'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function useDeleteInventory(id: string) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function deleteInventory() {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
      return true
    } catch (err) {
      alert('Failed to delete inventory')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { loading, deleteInventory }
}
