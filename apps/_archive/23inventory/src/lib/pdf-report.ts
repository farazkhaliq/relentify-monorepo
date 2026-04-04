import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface InventoryData {
  propertyAddress: string
  type: string
  createdBy: string
  createdAt: Date
  notes: string | null
  photos: Array<{
    room: string
    description: string | null
    condition: string
    imageData: string | null
  }>
}

/**
 * Generate a PDF report for a property inventory.
 * Returns the PDF as a Buffer.
 */
export async function generateInventoryPdf(inventory: InventoryData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const PAGE_WIDTH = 595 // A4
  const PAGE_HEIGHT = 842
  const MARGIN = 50
  const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  // --- Header ---
  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 80, width: PAGE_WIDTH, height: 80,
    color: rgb(0.04, 0.04, 0.04),
  })
  page.drawText('Property Inventory Report', {
    x: MARGIN, y: PAGE_HEIGHT - 35, size: 18, font: helveticaBold, color: rgb(1, 1, 1),
  })
  page.drawText('Relentify E-Sign', {
    x: MARGIN, y: PAGE_HEIGHT - 55, size: 10, font: helvetica, color: rgb(0.6, 0.6, 0.6),
  })
  y = PAGE_HEIGHT - 100

  // --- Property details ---
  const typeLabel = inventory.type === 'check-in' ? 'Check-In' : 'Check-Out'
  const dateStr = new Date(inventory.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const details = [
    ['Property', inventory.propertyAddress],
    ['Type', typeLabel],
    ['Agent', inventory.createdBy],
    ['Date', dateStr],
  ]

  for (const [label, value] of details) {
    page.drawText(`${label}:`, {
      x: MARGIN, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4),
    })
    page.drawText(value, {
      x: MARGIN + 70, y, size: 10, font: helvetica, color: rgb(0, 0, 0),
    })
    y -= 18
  }

  if (inventory.notes) {
    y -= 10
    page.drawText('Notes:', {
      x: MARGIN, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4),
    })
    y -= 14
    // Wrap notes text
    const words = inventory.notes.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (helvetica.widthOfTextAtSize(test, 9) > CONTENT_WIDTH) {
        page.drawText(line, { x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
        y -= 12
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
      y -= 12
    }
  }

  // --- Photos by room ---
  y -= 20
  const rooms = [...new Set(inventory.photos.map(p => p.room))]

  for (const room of rooms) {
    const roomPhotos = inventory.photos.filter(p => p.room === room)

    // Check if we need a new page
    if (y < 150) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }

    // Room header
    page.drawText(room, {
      x: MARGIN, y, size: 13, font: helveticaBold, color: rgb(0, 0, 0),
    })
    page.drawText(`${roomPhotos.length} photo${roomPhotos.length !== 1 ? 's' : ''}`, {
      x: MARGIN + helveticaBold.widthOfTextAtSize(room, 13) + 10,
      y, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5),
    })
    y -= 6
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1, color: rgb(0.85, 0.85, 0.85),
    })
    y -= 16

    for (const photo of roomPhotos) {
      if (y < 120) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        y = PAGE_HEIGHT - MARGIN
      }

      // Try to embed photo
      if (photo.imageData) {
        try {
          const imgBytes = Buffer.from(
            photo.imageData.replace(/^data:image\/\w+;base64,/, ''),
            'base64'
          )
          const isJpeg = photo.imageData.startsWith('data:image/jpeg') || photo.imageData.startsWith('data:image/jpg')
          const img = isJpeg
            ? await doc.embedJpg(imgBytes)
            : await doc.embedPng(imgBytes)

          // Scale to fit width (max 200px wide, maintain aspect ratio)
          const maxW = 200
          const maxH = 150
          const scale = Math.min(maxW / img.width, maxH / img.height, 1)
          const drawW = img.width * scale
          const drawH = img.height * scale

          page.drawImage(img, { x: MARGIN, y: y - drawH, width: drawW, height: drawH })

          // Photo details to the right of the image
          const textX = MARGIN + drawW + 15

          // Condition
          const condColor = photo.condition === 'Good' ? rgb(0.13, 0.77, 0.37)
            : photo.condition === 'Poor' ? rgb(0.94, 0.27, 0.27) : rgb(0.96, 0.62, 0.04)
          page.drawText(`● ${photo.condition}`, {
            x: textX, y: y - 12, size: 10, font: helveticaBold, color: condColor,
          })

          if (photo.description) {
            page.drawText(photo.description, {
              x: textX, y: y - 28, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3),
            })
          }

          y -= Math.max(drawH, 40) + 15
        } catch {
          // Image embed failed — skip
          page.drawText(`[Photo: ${photo.condition}] ${photo.description || ''}`, {
            x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5),
          })
          y -= 16
        }
      } else {
        page.drawText(`[No image] ${photo.condition} — ${photo.description || ''}`, {
          x: MARGIN, y, size: 9, font: helvetica, color: rgb(0.5, 0.5, 0.5),
        })
        y -= 16
      }
    }

    y -= 10
  }

  // --- Signature section ---
  if (y < 150) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  y -= 20
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1, color: rgb(0.85, 0.85, 0.85),
  })
  y -= 30

  page.drawText('Agent Signature', {
    x: MARGIN, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4),
  })
  page.drawText('Tenant Signature', {
    x: PAGE_WIDTH / 2 + 10, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4),
  })

  y -= 5
  // Signature lines
  page.drawLine({
    start: { x: MARGIN, y: y - 40 }, end: { x: PAGE_WIDTH / 2 - 20, y: y - 40 },
    thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
  })
  page.drawLine({
    start: { x: PAGE_WIDTH / 2 + 10, y: y - 40 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 40 },
    thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
  })

  page.drawText(inventory.createdBy, {
    x: MARGIN, y: y - 55, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
