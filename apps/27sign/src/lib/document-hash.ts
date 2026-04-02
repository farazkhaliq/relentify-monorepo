import { createHash } from 'crypto'

export function computeDocumentHash(pdfBase64: string): string {
  const binary = Buffer.from(pdfBase64, 'base64')
  return createHash('sha256').update(binary).digest('hex')
}
