import { NextRequest, NextResponse } from 'next/server'
import { verifySignerSession } from '@/lib/signer-session'
import { isOtpVerified } from '@/lib/otp'
import { getSignerByToken } from '@/lib/signers'
import { getDocumentPdf } from '@/lib/document'
import { query } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Try session auth first, fall back to legacy OTP check
  const session = await verifySignerSession(req)

  let signerEmail: string
  let signingRequestId: string
  let documentId: string | null
  let title: string
  let bodyText: string

  if (session) {
    signerEmail = session.signerEmail
    signingRequestId = session.signingRequestId

    const { rows } = await query(
      `SELECT sr.title, sr.body_text, sr.document_id
       FROM signing_requests sr
       WHERE sr.id = $1`,
      [signingRequestId]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    title = rows[0].title
    bodyText = rows[0].body_text
    documentId = rows[0].document_id ?? null
  } else {
    // Legacy: look up signer by URL token, check OTP verified
    const signer = await getSignerByToken(token)
    if (!signer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const verified = await isOtpVerified(signer.signing_request_id)
    if (!verified) return NextResponse.json({ error: 'Not verified' }, { status: 403 })

    signerEmail = signer.email
    signingRequestId = signer.signing_request_id
    title = signer.title
    bodyText = signer.body_text
    documentId = signer.document_id ?? null
  }

  // Get signer's fields
  let fields: unknown[] = []
  if (documentId) {
    const { rows: fieldRows } = await query(
      `SELECT * FROM document_fields
       WHERE document_id = $1 AND signer_email = $2
       ORDER BY page_number ASC, y_percent ASC`,
      [documentId, signerEmail]
    )
    fields = fieldRows
  }

  // Get PDF data (null for text-only requests)
  const pdf = documentId ? await getDocumentPdf(documentId) : null

  return NextResponse.json({ pdf, fields, title, bodyText })
}
