import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getConversationById } from '@/lib/services/conversation.service'
import { getMessages, createMessage } from '@/lib/services/message.service'
import { sendMessage as sendWhatsApp } from '@/lib/services/whatsapp.service'
import { sendEmail } from '@/lib/services/email-channel.service'
import { sendSMS } from '@/lib/services/sms.service'
import { sendMessage as sendFB } from '@/lib/services/facebook.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conv = await getConversationById(id)
  if (!conv || conv.entity_id !== user.activeEntityId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const since = req.nextUrl.searchParams.get('since') || undefined
  return NextResponse.json(await getMessages(id, since))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conv = await getConversationById(id)
  if (!conv || conv.entity_id !== user.activeEntityId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  // Create message in DB
  const msg = await createMessage({
    conversation_id: id,
    entity_id: user.activeEntityId,
    channel: conv.channel,
    sender_type: body.sender_type || 'agent',
    sender_id: user.userId,
    body: body.body.trim(),
  })

  // Send to external channel (async, non-blocking)
  if (body.sender_type !== 'note') {
    dispatchToChannel(conv, body.body.trim(), user.activeEntityId).catch(err =>
      console.error(`Channel dispatch error (${conv.channel}):`, err.message)
    )
  }

  return NextResponse.json(msg, { status: 201 })
}

async function dispatchToChannel(conv: any, text: string, entityId: string) {
  const { channel, external_id, contact_email, contact_phone } = conv

  switch (channel) {
    case 'whatsapp':
      if (external_id) await sendWhatsApp(entityId, external_id, text)
      break
    case 'email':
      if (contact_email) await sendEmail(entityId, contact_email, conv.subject || 'Re: Support', text)
      break
    case 'sms':
      if (contact_phone || external_id) await sendSMS(entityId, contact_phone || external_id, text)
      break
    case 'facebook':
    case 'instagram':
      if (external_id) await sendFB(entityId, external_id, text, channel as any)
      break
    // 'web' and 'voice' don't dispatch externally from here
  }
}
