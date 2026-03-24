import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const inventoryId = formData.get('inventoryId') as string
  const room = formData.get('room') as string
  const condition = (formData.get('condition') as string) || 'Good'
  const description = (formData.get('description') as string) || ''
  const imageData = formData.get('imageData') as string | null

  if (!inventoryId || !room) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const photo = await prisma.photo.create({
    data: {
      inventoryId,
      room,
      condition,
      description: description || null,
      imageData: imageData || null,
    },
  })

  return NextResponse.json(photo, { status: 201 })
}
