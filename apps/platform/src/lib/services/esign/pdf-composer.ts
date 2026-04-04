import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { query } from './db'
import { appendAuditLog } from './audit'
import { computeDocumentHash } from './document-hash'

/**
 * Composite filled document_fields onto the original PDF and store the result.
 * Returns the signed PDF as base64.
 */
export async function compositeSignedPdf(signingRequestId: string): Promise<string> {
  // 1. Load the signing request to get document_id
  const { rows: srRows } = await query(
    'SELECT id, document_id FROM esign_signing_requests WHERE id = $1',
    [signingRequestId]
  )
  if (!srRows.length || !srRows[0].document_id) {
    throw new Error(`No document found for signing request ${signingRequestId}`)
  }
  const documentId = srRows[0].document_id

  // 2. Load the document's pdf_data and page_dimensions
  const { rows: docRows } = await query(
    'SELECT pdf_data, page_dimensions FROM esign_documents WHERE id = $1',
    [documentId]
  )
  if (!docRows.length) {
    throw new Error(`Document ${documentId} not found`)
  }
  const { pdf_data: pdfBase64, page_dimensions: pageDimensions } = docRows[0]

  // 3. Compute pre-sign hash of original PDF
  const preSignHash = computeDocumentHash(pdfBase64)

  // 4. Load all filled document_fields for this document
  const { rows: fields } = await query(
    `SELECT field_type, page_number, x_percent, y_percent,
            width_percent, height_percent, value
     FROM esign_document_fields
     WHERE document_id = $1 AND value IS NOT NULL
     ORDER BY page_number ASC`,
    [documentId]
  )

  // 5. Open the PDF with pdf-lib
  const pdfBytes = Buffer.from(pdfBase64, 'base64')
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // 6. Draw each filled field onto the PDF
  for (const field of fields) {
    const pageIndex = field.page_number - 1
    if (pageIndex < 0 || pageIndex >= pages.length) continue

    const page = pages[pageIndex]
    const dims = pageDimensions[pageIndex] as { width: number; height: number; rotation: number }

    const xPercent = parseFloat(field.x_percent)
    const yPercent = parseFloat(field.y_percent)
    const widthPercent = parseFloat(field.width_percent)
    const heightPercent = parseFloat(field.height_percent)

    const x = (xPercent / 100) * dims.width
    const fieldWidth = (widthPercent / 100) * dims.width
    const fieldHeight = (heightPercent / 100) * dims.height
    // Flip Y: top-left percentage origin to bottom-left PDF points
    const y = dims.height - ((yPercent / 100) * dims.height) - fieldHeight

    const value: string = field.value

    if (field.field_type === 'signature' || field.field_type === 'initials') {
      // Decode base64 image and embed
      try {
        const rawBase64 = value.replace(/^data:image\/\w+;base64,/, '')
        const sigBytes = new Uint8Array(Buffer.from(rawBase64, 'base64'))

        let image
        if (value.startsWith('data:image/jpeg') || value.startsWith('data:image/jpg')) {
          image = await pdfDoc.embedJpg(sigBytes)
        } else {
          // Default to PNG (most signature pads produce PNG)
          image = await pdfDoc.embedPng(sigBytes)
        }

        page.drawImage(image, {
          x,
          y,
          width: fieldWidth,
          height: fieldHeight,
        })
      } catch (err) {
        console.error(`Failed to embed ${field.field_type} image on page ${field.page_number}:`, err)
        // Continue with other fields rather than failing entirely
      }
    } else {
      // date or text field
      const fontSize = Math.min(12, fieldHeight * 0.6)
      page.drawText(value, {
        x: x + 2,
        y: y + fieldHeight * 0.3,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }

  // 7. Save the modified PDF
  const signedPdfBytes = await pdfDoc.save()
  const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64')

  // 8. Compute post-sign hash
  const postSignHash = computeDocumentHash(signedPdfBase64)

  // 9. Store signed_pdf_data, hashes, and mark all_signed
  await query(
    `UPDATE esign_signing_requests
     SET signed_pdf_data = $2,
         pre_sign_hash   = $3,
         post_sign_hash  = $4,
         all_signed       = TRUE,
         updated_at       = NOW()
     WHERE id = $1`,
    [signingRequestId, signedPdfBase64, preSignHash, postSignHash]
  )

  // 10. Audit log
  await appendAuditLog({
    signingRequestId,
    action: 'pdf_generated',
    details: {
      documentId,
      preSignHash,
      postSignHash,
      fieldCount: fields.length,
    },
  })

  return signedPdfBase64
}
