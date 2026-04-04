import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check for connect billing info in connect_conversations metadata or a dedicated config
  // For now return basic plan info
  return NextResponse.json({ plan: 'starter', seats: 1 })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { plan, seats } = body

  if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

  // Stripe checkout would be created here
  // For now return placeholder
  return NextResponse.json({ message: 'Stripe billing integration pending', plan, seats })
}
