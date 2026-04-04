import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { verifyApiKey } from '@/lib/services/esign/auth-api'
import { query } from '@/lib/services/esign/db'
import { generateToken } from '@/lib/services/esign/tokens'
import { appendAuditLog } from '@/lib/services/esign/audit'
import { getOrCreateSubscription, incrementRequestCount } from '@/lib/services/esign/subscription'
import { getRequestLimit } from '@/lib/services/esign/tiers'
import { uploadDocument } from '@/lib/services/esign/document'
import { createSigners } from '@/lib/services/esign/signers'

export async function POST(req: NextRequest) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check usage limits if key belongs to a user
  if (auth.userId) {
    const sub = await getOrCreateSubscription(auth.userId)
    const limit = getRequestLimit(sub.tier)
    if (sub.requestsThisMonth >= limit) {
      return NextResponse.json({
        error: `Monthly limit reached (${limit} requests). Upgrade your plan for more.`
      }, { status: 429 })
    }
    await incrementRequestCount(auth.userId)
  }

  await query('UPDATE esign_api_keys SET request_count = request_count + 1, last_used_at = NOW() WHERE id = $1', [auth.keyId])

  // Detect content type: multipart (document flow) or JSON (text-only)
  const contentType = req.headers.get('content-type') || ''
  const isMultipart = contentType.includes('multipart/form-data')

  let title: string
  let bodyText: string
  let callbackUrl: string | null = null
  let callbackSecret: string | null = null
  let metadata: Record<string, unknown> | null = null
  let expiresInDays = 30
  let createdByUserId: string | null = null
  let createdByEntityId: string | null = null
  let senderEmail: string | null = null
  let signingMode: string = 'single'

  // Document flow fields
  let file: File | null = null
  let signersList: Array<{ email: string; name?: string; signOrder?: number }> = []
  let fieldsList: Array<{
    signerEmail: string; fieldType: string; label?: string
    pageNumber: number; xPercent: number; yPercent: number
    widthPercent: number; heightPercent: number
    prefilled?: boolean; value?: string
  }> = []

  // Legacy text-only fields
  let signerEmail: string | null = null
  let signerName: string | null = null

  if (isMultipart) {
    // --- Document signing: one-call API ---
    const formData = await req.formData()

    file = formData.get('file') as File | null
    title = (formData.get('title') as string) || ''
    bodyText = (formData.get('bodyText') as string) || 'Please review and sign this document.'
    callbackUrl = (formData.get('callbackUrl') as string) || null
    callbackSecret = (formData.get('callbackSecret') as string) || null
    senderEmail = (formData.get('senderEmail') as string) || null
    createdByUserId = (formData.get('createdByUserId') as string) || null
    createdByEntityId = (formData.get('createdByEntityId') as string) || null
    signingMode = (formData.get('signingMode') as string) || 'single'

    const metadataStr = formData.get('metadata') as string | null
    if (metadataStr) try { metadata = JSON.parse(metadataStr) } catch {}

    const signersStr = formData.get('signers') as string | null
    if (signersStr) try { signersList = JSON.parse(signersStr) } catch {}

    const fieldsStr = formData.get('fields') as string | null
    if (fieldsStr) try { fieldsList = JSON.parse(fieldsStr) } catch {}

    const expStr = formData.get('expiresInDays') as string | null
    if (expStr) expiresInDays = parseInt(expStr) || 30

    if (!file) return NextResponse.json({ error: 'file is required for document signing' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (signersList.length === 0) return NextResponse.json({ error: 'signers array is required' }, { status: 400 })

    // Use first signer for the legacy signer_email field
    signerEmail = signersList[0].email
    signerName = signersList[0].name || null
  } else {
    // --- Legacy text-only: JSON body ---
    const body = await req.json()
    signerEmail = body.signerEmail
    signerName = body.signerName || null
    title = body.title || ''
    bodyText = body.bodyText || ''
    callbackUrl = body.callbackUrl || null
    callbackSecret = body.callbackSecret || null
    metadata = body.metadata || null
    expiresInDays = body.expiresInDays || 30
    createdByUserId = body.createdByUserId || null
    createdByEntityId = body.createdByEntityId || null
    senderEmail = body.senderEmail || null
    signingMode = body.signingMode || 'single'

    if (body.signers) signersList = body.signers
    if (body.fields) fieldsList = body.fields

    if (!signerEmail || !title || !bodyText) {
      return NextResponse.json({ error: 'signerEmail, title, and bodyText are required' }, { status: 400 })
    }
  }

  const token = generateToken()
  const bodyTextHash = createHash('sha256').update(bodyText).digest('hex')
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

  // 1. Create signing request
  const { rows } = await query(
    `INSERT INTO esign_signing_requests
     (token, app_id, api_key_id, signer_email, signer_name, title, body_text, body_text_hash,
      metadata, callback_url, callback_secret, expires_at, created_by_user_id, created_by_entity_id,
      sender_email, signing_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id, token`,
    [
      token, auth.appId, auth.keyId,
      signerEmail!.toLowerCase().trim(), signerName,
      title, bodyText, bodyTextHash,
      metadata ? JSON.stringify(metadata) : null,
      callbackUrl, callbackSecret,
      expiresAt.toISOString(),
      createdByUserId, createdByEntityId, senderEmail, signingMode,
    ]
  )

  const signingRequest = rows[0]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

  // 2. Upload document if provided
  let documentId: string | null = null
  let pageCount = 0

  if (file) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploadResult = await uploadDocument(buffer, file.name, file.type, signingRequest.id)
      documentId = uploadResult.documentId
      pageCount = uploadResult.pageCount
    } catch (err) {
      // Clean up the signing request if upload fails
      await query('DELETE FROM esign_signing_requests WHERE id = $1', [signingRequest.id])
      const message = err instanceof Error ? err.message : 'Document upload failed'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  // 3. Create signers if provided
  let signerTokens: Array<{ id: string; email: string; token: string }> = []

  if (signersList.length > 0) {
    signerTokens = await createSigners(signingRequest.id, signersList.map((s, i) => ({
      email: s.email,
      name: s.name,
      signOrder: s.signOrder || (signingMode === 'sequential' ? i + 1 : 1),
    })))
  }

  // 4. Save field placements if provided
  if (fieldsList.length > 0 && documentId) {
    for (const field of fieldsList) {
      // pageNumber -1 means "last page"
      const resolvedPage = field.pageNumber === -1 ? pageCount : field.pageNumber
      await query(
        `INSERT INTO esign_document_fields
         (document_id, signer_email, field_type, label, page_number,
          x_percent, y_percent, width_percent, height_percent, prefilled, value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          documentId,
          field.signerEmail.toLowerCase().trim(),
          field.fieldType,
          field.label || null,
          resolvedPage,
          field.xPercent, field.yPercent,
          field.widthPercent, field.heightPercent,
          field.prefilled || false,
          field.value || null,
        ]
      )
    }
  }

  await appendAuditLog({
    signingRequestId: signingRequest.id,
    action: 'created',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    details: {
      appId: auth.appId,
      hasDocument: !!file,
      signerCount: signersList.length || 1,
      fieldCount: fieldsList.length,
    },
  })

  // Build response
  const response: Record<string, unknown> = {
    id: signingRequest.id,
    token: signingRequest.token,
    signingUrl: `${appUrl}/s/${signingRequest.token}`,
    status: 'pending',
    expiresAt: expiresAt.toISOString(),
  }

  if (documentId) {
    response.documentId = documentId
    response.pageCount = pageCount
  }

  if (signerTokens.length > 0) {
    response.signers = signerTokens.map(s => ({
      id: s.id,
      email: s.email,
      signingUrl: `${appUrl}/s/${s.token}`,
    }))
  }

  return NextResponse.json(response, { status: 201 })
}
