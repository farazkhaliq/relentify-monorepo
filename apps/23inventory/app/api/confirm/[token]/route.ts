import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const inventory = await prisma.inventory.findUnique({
    where: { confirmToken: token },
    select: { propertyAddress: true, type: true, createdBy: true, createdAt: true, tenantConfirmed: true },
  })
  if (!inventory) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(inventory)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
  const inventory = await prisma.inventory.findUnique({ where: { confirmToken: token } })
  if (!inventory) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (inventory.tenantConfirmed) return NextResponse.json({ error: 'Already confirmed' }, { status: 409 })
  await prisma.inventory.update({
    where: { confirmToken: token },
    data: { tenantConfirmed: true, confirmedAt: new Date(), confirmedIp: ip },
  })
  return NextResponse.json({ success: true })
}
