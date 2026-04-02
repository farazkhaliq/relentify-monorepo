import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/db'

const PATTERNS = [
  { regex: /sign(ature|ed|)\s*(here|below|:)/gi, type: 'signature', label: 'Signature' },
  { regex: /initial(s|)\s*(here|below|:)/gi, type: 'initials', label: 'Initials' },
  { regex: /date\s*[:_]/gi, type: 'date', label: 'Date' },
  { regex: /print\s*name/gi, type: 'text', label: 'Print Name' },
  { regex: /full\s*name/gi, type: 'text', label: 'Full Name' },
  { regex: /email\s*(address|)\s*[:_]/gi, type: 'text', label: 'Email' },
  { regex: /title\s*[:_]/gi, type: 'text', label: 'Title' },
  { regex: /company\s*(name|)\s*[:_]/gi, type: 'text', label: 'Company' },
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch document
  const { rows } = await query(
    `SELECT d.id, d.file_data, d.page_count
     FROM documents d
     JOIN signing_requests sr ON sr.document_id = d.id
     WHERE d.id = $1 AND sr.created_by_user_id = $2
     LIMIT 1`,
    [id, user.userId]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const doc = rows[0]
  const pageCount = doc.page_count || 1

  try {
    // Decode the PDF binary (stored as base64 in file_data)
    const pdfBuffer = Buffer.from(doc.file_data, 'base64')
    // Convert to string for keyword scanning (crude but effective for text-based PDFs)
    const rawText = pdfBuffer.toString('latin1')

    // Split roughly by page boundaries using PDF page markers
    // PDF pages typically have /Type /Page objects
    const pageChunks: string[] = []
    const pageSplits = rawText.split(/\/Type\s*\/Page[^s]/i)

    if (pageSplits.length > 1) {
      // Skip the first chunk (before any page), assign rest to pages
      for (let i = 1; i < pageSplits.length && i <= pageCount; i++) {
        pageChunks.push(pageSplits[i])
      }
    } else {
      // Fallback: treat entire PDF as one page
      pageChunks.push(rawText)
    }

    const suggestions: Array<{
      type: string
      label: string
      pageNumber: number
      confidence: string
    }> = []

    const seen = new Set<string>()

    for (let pageIdx = 0; pageIdx < pageChunks.length; pageIdx++) {
      const chunk = pageChunks[pageIdx]

      for (const pattern of PATTERNS) {
        // Reset regex state
        pattern.regex.lastIndex = 0
        if (pattern.regex.test(chunk)) {
          const key = `${pattern.type}:${pattern.label}:${pageIdx + 1}`
          if (!seen.has(key)) {
            seen.add(key)
            suggestions.push({
              type: pattern.type,
              label: pattern.label,
              pageNumber: pageIdx + 1,
              confidence: 'keyword_match',
            })
          }
        }
      }
    }

    return NextResponse.json({ suggestions, pageCount })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to analyze document', detail: err.message },
      { status: 500 }
    )
  }
}
