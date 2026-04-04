'use client'
import { useState } from 'react'

type Photo = {
  id: string
  room: string
  condition: string
  description: string | null
  imageData: string | null
  uploadedAt: string
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 1400
        let w = img.width, h = img.height
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function usePhotoManager(inventoryId: string, initialPhotos: Photo[]) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [rooms, setRooms] = useState<string[]>(() =>
    Array.from(new Set(initialPhotos.map(p => p.room)))
  )
  const [activeRoom, setActiveRoom] = useState<string | null>(() => {
    const existing = Array.from(new Set(initialPhotos.map(p => p.room)))
    return existing.length > 0 ? existing[0] : null
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  function addRoom(room: string) {
    const trimmed = room.trim()
    if (!trimmed || rooms.includes(trimmed)) return
    setRooms(prev => [...prev, trimmed])
    setActiveRoom(trimmed)
  }

  async function uploadPhotos(files: File[], room: string, condition: string, description: string) {
    if (!files.length || !room) return
    setUploading(true)
    setError('')
    for (const file of files) {
      try {
        const imageData = await compressImage(file)
        const fd = new FormData()
        fd.append('inventoryId', inventoryId)
        fd.append('room', room)
        fd.append('condition', condition)
        fd.append('description', description)
        fd.append('imageData', imageData)
        const res = await fetch('/api/inventory/photos', { method: 'POST', body: fd })
        if (!res.ok) throw new Error()
        const photo = await res.json()
        setPhotos(prev => [...prev, photo])
        if (!rooms.includes(room)) setRooms(prev => [...prev, room])
      } catch {
        setError('Upload sequence failed.')
      }
    }
    setUploading(false)
    setSavedAt(new Date())
  }

  async function deletePhoto(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/photos/${id}`, { method: 'DELETE' })
      setPhotos(prev => prev.filter(p => p.id !== id))
      setSavedAt(new Date())
    } catch {
      setError('Deletion protocol failed.')
    }
    setDeletingId(null)
  }

  return {
    photos,
    rooms,
    activeRoom,
    setActiveRoom,
    uploading,
    error,
    setError,
    deletingId,
    savedAt,
    addRoom,
    uploadPhotos,
    deletePhoto,
  }
}
