import { writeFile, mkdir, readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { randomBytes } from 'crypto'
import { PDFDocument } from 'pdf-lib'
import { query } from './db'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx']
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const CONVERSION_TIMEOUT_MS = 30_000
const CONVERSION_MAX_RETRIES = 3

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  documentId: string
  pageCount: number
  pageDimensions: Array<{ width: number; height: number; rotation: number }>
}

export interface DocumentInfo {
  id: string
  signingRequestId: string
  originalFilename: string
  originalFormat: string
  pageCount: number
  pageDimensions: Array<{ width: number; height: number; rotation: number }>
  uploadedAt: Date
}

// ---------------------------------------------------------------------------
// Semaphore — limit concurrent LibreOffice conversions to 1
// ---------------------------------------------------------------------------

let conversionLock = false
const conversionQueue: Array<() => void> = []

function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!conversionLock) {
      conversionLock = true
      resolve()
    } else {
      conversionQueue.push(resolve)
    }
  })
}

function releaseLock(): void {
  const next = conversionQueue.shift()
  if (next) {
    next()
  } else {
    conversionLock = false
  }
}

// ---------------------------------------------------------------------------
// PDF utilities
// ---------------------------------------------------------------------------

async function extractPageDimensions(
  pdfBuffer: Buffer
): Promise<{ pageCount: number; pageDimensions: Array<{ width: number; height: number; rotation: number }> }> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const pages = pdfDoc.getPages()

  const pageDimensions = pages.map((page) => {
    const { width, height } = page.getSize()
    const rotation = page.getRotation().angle
    return { width, height, rotation }
  })

  return { pageCount: pages.length, pageDimensions }
}

// ---------------------------------------------------------------------------
// Word → PDF conversion via LibreOffice
// ---------------------------------------------------------------------------

async function convertWordToPdf(wordBuffer: Buffer, originalFilename: string): Promise<Buffer> {
  const tmpDir = '/tmp'
  const outputDir = path.join(tmpDir, `lo-out-${randomBytes(8).toString('hex')}`)
  const inputFile = path.join(tmpDir, `lo-in-${randomBytes(8).toString('hex')}-${originalFilename}`)

  await acquireLock()

  let attempt = 0
  let lastError: Error | null = null

  try {
    await mkdir(outputDir, { recursive: true })
    await writeFile(inputFile, wordBuffer)

    while (attempt < CONVERSION_MAX_RETRIES) {
      attempt++
      try {
        await execFileAsync(
          'libreoffice',
          ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputFile],
          { timeout: CONVERSION_TIMEOUT_MS }
        )

        // LibreOffice names the output file by replacing the extension
        const base = path.basename(inputFile, path.extname(inputFile))
        const outputFile = path.join(outputDir, `${base}.pdf`)

        if (!existsSync(outputFile)) {
          throw new Error(`LibreOffice did not produce output file at ${outputFile}`)
        }

        const pdfBuffer = await readFile(outputFile)
        return pdfBuffer
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < CONVERSION_MAX_RETRIES) {
          // Brief pause before retry
          await new Promise((r) => setTimeout(r, 500 * attempt))
        }
      }
    }

    throw new Error(
      `Word→PDF conversion failed after ${CONVERSION_MAX_RETRIES} attempts: ${lastError?.message}`
    )
  } finally {
    releaseLock()

    // Clean up temp files — best-effort, don't throw
    await rm(inputFile, { force: true }).catch(() => {})
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate, convert if needed, extract dimensions, and persist a document.
 */
export async function uploadDocument(
  file: Buffer,
  filename: string,
  mimeType: string,
  signingRequestId: string
): Promise<UploadResult> {
  // --- Validate file size ---
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  // --- Validate extension ---
  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }

  // --- Validate MIME type (secondary check) ---
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`MIME type not allowed: ${mimeType}`)
  }

  // --- Convert Word to PDF if needed ---
  let pdfBuffer: Buffer
  const originalFormat = ext === '.pdf' ? 'pdf' : 'docx'

  if (ext === '.docx') {
    pdfBuffer = await convertWordToPdf(file, filename)
  } else {
    pdfBuffer = file
  }

  // --- Extract page dimensions ---
  const { pageCount, pageDimensions } = await extractPageDimensions(pdfBuffer)

  if (pageCount === 0) {
    throw new Error('Document contains no pages')
  }

  // --- Store as base64 in DB ---
  const pdfBase64 = pdfBuffer.toString('base64')

  const { rows } = await query(
    `INSERT INTO documents
       (signing_request_id, original_filename, original_format, pdf_data, page_count, page_dimensions, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [
      signingRequestId,
      filename,
      originalFormat,
      pdfBase64,
      pageCount,
      JSON.stringify(pageDimensions),
    ]
  )

  return {
    documentId: rows[0].id as string,
    pageCount,
    pageDimensions,
  }
}

/**
 * Return the raw base64 PDF data for a document, or null if not found.
 */
export async function getDocumentPdf(documentId: string): Promise<string | null> {
  const { rows } = await query(
    'SELECT pdf_data FROM documents WHERE id = $1',
    [documentId]
  )

  if (rows.length === 0) return null
  return rows[0].pdf_data as string
}

/**
 * Return document metadata (no pdf_data — that column is large).
 */
export async function getDocumentInfo(documentId: string): Promise<DocumentInfo | null> {
  const { rows } = await query(
    `SELECT id, signing_request_id, original_filename, original_format,
            page_count, page_dimensions, uploaded_at
     FROM documents
     WHERE id = $1`,
    [documentId]
  )

  if (rows.length === 0) return null

  const row = rows[0]
  return {
    id: row.id as string,
    signingRequestId: row.signing_request_id as string,
    originalFilename: row.original_filename as string,
    originalFormat: row.original_format as string,
    pageCount: row.page_count as number,
    pageDimensions: row.page_dimensions as Array<{ width: number; height: number; rotation: number }>,
    uploadedAt: row.uploaded_at as Date,
  }
}
