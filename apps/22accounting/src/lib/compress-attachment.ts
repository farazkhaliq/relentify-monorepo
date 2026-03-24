import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

const MAX_DIMENSION = 2000;  // px — sufficient for receipt legibility
const WEBP_QUALITY = 80;     // visually lossless for documents
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CompressResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Compress an uploaded file before storage.
 * Images  → WEBP @ q80, max 2000px longest edge (via sharp, if available).
 * PDFs    → Ghostscript /ebook preset (150 DPI). 10MB → ~1–2MB typical.
 * Always returns the smaller of compressed vs original.
 * Falls back to storing original if sharp is not available.
 */
export async function compressAttachment(
  buffer: Buffer,
  originalMimeType: string
): Promise<CompressResult> {
  if (IMAGE_TYPES.includes(originalMimeType)) {
    return compressImage(buffer, originalMimeType);
  }
  if (originalMimeType === 'application/pdf') {
    return compressPdf(buffer);
  }
  return { buffer, mimeType: originalMimeType };
}

async function compressImage(buffer: Buffer, originalMimeType: string): Promise<CompressResult> {
  try {
    // Dynamic import with graceful fallback if sharp is unavailable
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require('sharp');
    const compressed = await sharp(buffer)
      .rotate()                    // auto-rotate from EXIF (fixes phone photos)
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',             // preserves aspect ratio, never upscales
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    if (compressed.length < buffer.length) {
      return { buffer: compressed, mimeType: 'image/webp' };
    }
    return { buffer, mimeType: originalMimeType };
  } catch {
    // sharp not available — store original image without compression
    return { buffer, mimeType: originalMimeType };
  }
}

async function compressPdf(buffer: Buffer): Promise<CompressResult> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}-in.pdf`);
  const outputPath = join(tmpdir(), `${id}-out.pdf`);

  try {
    await writeFile(inputPath, buffer);

    // /ebook = 150 DPI — good balance of size and legibility for receipts
    await execAsync(
      `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook ` +
      `-dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`
    );

    const compressed = await readFile(outputPath);
    if (compressed.length < buffer.length) {
      return { buffer: compressed, mimeType: 'application/pdf' };
    }
    return { buffer, mimeType: 'application/pdf' };
  } catch {
    // Ghostscript not available or failed — store original PDF
    return { buffer, mimeType: 'application/pdf' };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
