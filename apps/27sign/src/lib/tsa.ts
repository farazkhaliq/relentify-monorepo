import { createHash } from 'crypto'

/**
 * Request a timestamp from a free RFC 3161 Time Stamping Authority.
 * Returns the TSA response as a base64-encoded string, or null on failure.
 *
 * Uses FreeTSA.org (free, no auth required).
 * The hash of the signing event data is sent as a timestamp query.
 */
export async function requestTimestamp(data: string): Promise<string | null> {
  try {
    const hash = createHash('sha256').update(data).digest()

    // Build a minimal ASN.1 TimeStampReq
    // This is a simplified approach using the query endpoint
    const tsaUrl = 'https://freetsa.org/tsr'

    const res = await fetch(tsaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query',
      },
      body: buildTimestampQuery(hash),
    })

    if (!res.ok) return null

    const tsaResponse = await res.arrayBuffer()
    return Buffer.from(tsaResponse).toString('base64')
  } catch {
    // TSA is optional — don't fail the signing flow
    return null
  }
}

/**
 * Build a minimal ASN.1 DER-encoded TimeStampReq.
 * RFC 3161 section 2.4.1
 */
function buildTimestampQuery(hash: Buffer): Buffer {
  // MessageImprint: SEQUENCE { AlgorithmIdentifier, OCTET STRING }
  // AlgorithmIdentifier for SHA-256: 30 0d 06 09 60 86 48 01 65 03 04 02 01 05 00
  const algId = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01,
    0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,
  ])

  // OCTET STRING wrapping the hash
  const hashOctet = Buffer.concat([
    Buffer.from([0x04, hash.length]),
    hash,
  ])

  // MessageImprint SEQUENCE
  const msgImprint = Buffer.concat([
    Buffer.from([0x30, algId.length + hashOctet.length]),
    algId,
    hashOctet,
  ])

  // Version INTEGER 1
  const version = Buffer.from([0x02, 0x01, 0x01])

  // CertReq BOOLEAN TRUE (request cert in response)
  const certReq = Buffer.from([0x01, 0x01, 0xff])

  // TimeStampReq SEQUENCE
  const body = Buffer.concat([version, msgImprint, certReq])
  const tsReq = Buffer.concat([
    Buffer.from([0x30, body.length]),
    body,
  ])

  return tsReq
}
