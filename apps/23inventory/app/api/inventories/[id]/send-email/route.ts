import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const inventory = await prisma.inventory.findUnique({
    where: { id: id, userId: user.userId },
  })
  if (!inventory) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { tenantEmail } = await req.json()
  const email = (tenantEmail || inventory.tenantEmail || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid tenant email is required' }, { status: 400 })
  }

  // Save email to inventory if new
  if (email !== inventory.tenantEmail) {
    await prisma.inventory.update({
      where: { id: id },
      data: { tenantEmail: email },
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://inventory.relentify.com'
  const confirmUrl = `${baseUrl}/confirm/${inventory.confirmToken}`
  const typeLabel = inventory.type === 'check-in' ? 'Check-In' : 'Check-Out'

  const { error } = await resend.emails.send({
    from: 'Relentify Inventory <inventory@resend.dev>',
    to: email,
    subject: `Please confirm your property ${typeLabel.toLowerCase()} — ${inventory.propertyAddress}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8F9FB; margin: 0; padding: 40px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.04); overflow: hidden;">
    <div style="background: #000000; padding: 32px 40px;">
      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">Inventory Confirmation</h1>
      <p style="color: rgba(255, 255, 255, 0.6); margin: 8px 0 0; font-size: 14px;">${inventory.propertyAddress}</p>
    </div>
    <div style="padding: 40px;">
      <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Hello, please review the property inventory report for your upcoming tenancy.
      </p>
      <div style="background: #F8F9FB; border-radius: 8px; padding: 24px; margin: 0 0 32px;">
        <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Property:</strong> ${inventory.propertyAddress}</p>
        <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Type:</strong> ${typeLabel}</p>
        <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 32px;"><strong>Agent:</strong> ${inventory.createdBy}</p>
        <a href="${confirmUrl}" style="display: inline-block; background: #10B981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 5rem; font-weight: 600; font-size: 15px;">View &amp; Confirm Inventory</a>
      </div>
      <p style="color: rgba(0, 0, 0, 0.4); font-size: 13px; margin: 24px 0 0; line-height: 1.5;">
        You can also copy and paste this link into your browser:
        <br />
        <a href="${confirmUrl}" style="color: #10B981; word-break: break-all;">${confirmUrl}</a>
      </p>
    </div>
    <div style="background: #F8F9FB; border-top: 1px solid rgba(0, 0, 0, 0.04); padding: 20px 40px;">
      <p style="color: rgba(0, 0, 0, 0.4); font-size: 12px; margin: 0;">Sent by Relentify Inventory · <a href="https://inventory.relentify.com" style="color: rgba(0, 0, 0, 0.4);">inventory.relentify.com</a></p>
    </div>
  </div>
</body>
</html>
`,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  await prisma.inventory.update({
    where: { id: id },
    data: { emailSentAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
