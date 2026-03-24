import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inventory = await prisma.inventory.findUnique({
    where: { id: id, userId: user.userId },
    include: { photos: { orderBy: { uploadedAt: 'asc' } } },
  })
  if (!inventory) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(inventory)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyAddress, type, createdBy, notes } = await request.json()
  const inventory = await prisma.inventory.update({
    where: { id: id, userId: user.userId },
    data: { propertyAddress, type, createdBy, notes },
  })
  return NextResponse.json(inventory)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.inventory.delete({ where: { id: id, userId: user.userId } })
  return NextResponse.json({ success: true })
}
