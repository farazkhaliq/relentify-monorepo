import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { toPhoto } from '@/lib/types'
import { generateInventoryPdf } from '@/lib/pdf-report'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const SIGNING_SERVICE_URL = process.env.SIGNING_SERVICE_URL || 'http://27sign:3000'
const SIGNING_API_KEY = process.env.SIGNING_API_KEY || ''

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await query('SELECT * FROM inv_items WHERE id=$1 AND user_id=$2', [id, user.userId])
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const inventory = rows[0]

  const { tenantEmail } = await req.json()
  const email = (tenantEmail || inventory.tenant_email || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid tenant email is required' }, { status: 400 })
  }

  if (email !== inventory.tenant_email) {
    await query('UPDATE inv_items SET tenant_email=$1 WHERE id=$2', [email, id])
  }

  const typeLabel = inventory.type === 'check-in' ? 'Check-In' : 'Check-Out'

  // Generate inventory PDF + create signing request via 27sign API
  let signingUrl: string
  let signingRequestId: string | null = null

  if (SIGNING_API_KEY) {
    try {
      // 1. Fetch photos and generate the inventory PDF
      const { rows: photoRows } = await query(
        'SELECT * FROM inv_photos WHERE inventory_id=$1 ORDER BY room ASC, uploaded_at ASC',
        [id]
      )
      const pdfBuffer = await generateInventoryPdf({
        propertyAddress: inventory.property_address,
        type: inventory.type,
        createdBy: inventory.created_by,
        createdAt: inventory.created_at,
        notes: inventory.notes,
        photos: photoRows.map(toPhoto).map(p => ({
          room: p.room, description: p.description, condition: p.condition, imageData: p.imageData,
        })),
      })

      // 2. Single API call: create request + upload PDF + place fields + add signer
      const formData = new FormData()
      formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), `inventory-${id}.pdf`)
      formData.append('title', `Inventory ${typeLabel} — ${inventory.property_address}`)
      formData.append('bodyText', `I, the undersigned, acknowledge the physical state of the property at ${inventory.property_address} as documented by ${inventory.created_by} on ${new Date(inventory.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`)
      formData.append('signers', JSON.stringify([{ email, name: null }]))
      formData.append('fields', JSON.stringify([
        { signerEmail: email, fieldType: 'signature', label: 'Tenant Signature', pageNumber: -1, xPercent: 55, yPercent: 82, widthPercent: 35, heightPercent: 7 },
        { signerEmail: email, fieldType: 'date', label: 'Date', pageNumber: -1, xPercent: 55, yPercent: 91, widthPercent: 20, heightPercent: 4 },
      ]))
      formData.append('callbackUrl', `${SIGNING_SERVICE_URL.replace('27sign:3000', '23inventory:3000')}/api/webhooks/signing`)
      formData.append('callbackSecret', process.env.SIGNING_WEBHOOK_SECRET || '')
      formData.append('metadata', JSON.stringify({ inventoryId: id, type: inventory.type }))
      formData.append('createdByUserId', user.userId)
      formData.append('senderEmail', user.email)

      const sigRes = await fetch(`${SIGNING_SERVICE_URL}/api/v1/requests`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SIGNING_API_KEY}` },
        body: formData,
      })

      if (!sigRes.ok) throw new Error('Failed to create signing request')
      const sigData = await sigRes.json()
      signingRequestId = sigData.id
      signingUrl = sigData.signingUrl

      // Store signing request ID on the inventory
      await query('UPDATE inv_items SET signing_request_id=$1 WHERE id=$2', [signingRequestId, id])
    } catch (err) {
      console.error('27sign integration error:', err)
      // Fallback to direct confirm link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://inventory.relentify.com'
      signingUrl = `${baseUrl}/confirm/${inventory.confirm_token}`
    }
  } else {
    // No signing service configured — use legacy confirm link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://inventory.relentify.com'
    signingUrl = `${baseUrl}/confirm/${inventory.confirm_token}`
  }

  const { error } = await resend.emails.send({
    from: 'Relentify Inventory <inventory@resend.dev>',
    to: email,
    subject: `Please confirm your property ${typeLabel.toLowerCase()} — ${inventory.property_address}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8F9FB; margin: 0; padding: 40px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.04); overflow: hidden;">
    <div style="background: #000000; padding: 32px 40px;">
      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">Inventory Confirmation</h1>
      <p style="color: rgba(255, 255, 255, 0.6); margin: 8px 0 0; font-size: 14px;">${inventory.property_address}</p>
    </div>
    <div style="padding: 40px;">
      <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Hello, please review and digitally sign the property inventory for your tenancy.
      </p>
      <div style="background: #F8F9FB; border-radius: 8px; padding: 24px; margin: 0 0 32px;">
        <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Property:</strong> ${inventory.property_address}</p>
        <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Type:</strong> ${typeLabel}</p>
        <p style="color: #000000; font-size: 15px; line-height: 1.6; margin: 0 0 32px;"><strong>Agent:</strong> ${inventory.created_by}</p>
        <a href="${signingUrl}" style="display: inline-block; background: #10B981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 5rem; font-weight: 600; font-size: 15px;">Review &amp; Sign Inventory</a>
      </div>
      <p style="color: rgba(0, 0, 0, 0.4); font-size: 13px; margin: 24px 0 0; line-height: 1.5;">
        You can also copy and paste this link into your browser:
        <br />
        <a href="${signingUrl}" style="color: #10B981; word-break: break-all;">${signingUrl}</a>
      </p>
    </div>
    <div style="background: #F8F9FB; border-top: 1px solid rgba(0, 0, 0, 0.04); padding: 20px 40px;">
      <p style="color: rgba(0, 0, 0, 0.4); font-size: 12px; margin: 0;">Sent by Relentify Inventory — Powered by Relentify E-Sign</p>
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

  await query('UPDATE inv_items SET email_sent_at=NOW() WHERE id=$1', [id])
  return NextResponse.json({ ok: true })
}
