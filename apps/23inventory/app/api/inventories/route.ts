import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inventories = await prisma.inventory.findMany({
    where: { userId: user.userId },
    include: { photos: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(inventories)
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyAddress, type, createdBy, notes, tenantEmail } = await request.json()
  if (!propertyAddress || !type || !createdBy) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const inventory = await prisma.inventory.create({
    data: { userId: user.userId, propertyAddress, type, createdBy, notes: notes || null, tenantEmail: tenantEmail || null },
  })
  return NextResponse.json(inventory, { status: 201 })
}
