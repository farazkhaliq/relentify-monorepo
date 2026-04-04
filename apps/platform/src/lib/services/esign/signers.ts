import { query } from './db'
import { generateToken } from './tokens'

export interface SignerInput {
  email: string
  name?: string
  signOrder?: number
}

export async function createSigners(
  signingRequestId: string,
  signers: SignerInput[]
): Promise<Array<{ id: string; email: string; token: string }>> {
  const created: Array<{ id: string; email: string; token: string }> = []

  for (const signer of signers) {
    const email = signer.email.toLowerCase().trim()
    const token = generateToken()
    const signOrder = signer.signOrder ?? 0

    const { rows } = await query(
      `INSERT INTO esign_signing_request_signers
        (signing_request_id, email, name, token, sign_order, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, email, token`,
      [signingRequestId, email, signer.name ?? null, token, signOrder]
    )

    created.push(rows[0])
  }

  return created
}

export async function getSignersForRequest(signingRequestId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM esign_signing_request_signers
     WHERE signing_request_id = $1
     ORDER BY sign_order ASC, created_at ASC`,
    [signingRequestId]
  )
  return rows
}

export async function getSignerByToken(token: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT s.*,
            sr.id         AS request_id,
            sr.document_id,
            sr.signing_mode,
            sr.title,
            sr.body_text
     FROM esign_signing_request_signers s
     JOIN esign_signing_requests sr ON sr.id = s.signing_request_id
     WHERE s.token = $1`,
    [token]
  )
  return rows[0] ?? null
}

export async function markSignerComplete(
  signerId: string,
  ip: string | null,
  snapshotHash: string
): Promise<void> {
  await query(
    `UPDATE esign_signing_request_signers
     SET status        = 'signed',
         signed_at     = NOW(),
         signed_ip     = $2,
         snapshot_hash = $3
     WHERE id = $1`,
    [signerId, ip, snapshotHash]
  )
}

export async function markSignerDeclined(
  signerId: string,
  reason: string | null
): Promise<void> {
  await query(
    `UPDATE esign_signing_request_signers
     SET status         = 'declined',
         decline_reason = $2,
         signed_at      = NOW()
     WHERE id = $1`,
    [signerId, reason]
  )
}

export async function areAllSignersComplete(signingRequestId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT
       COUNT(*)                                              AS total,
       COUNT(*) FILTER (WHERE status IN ('signed', 'declined')) AS done
     FROM esign_signing_request_signers
     WHERE signing_request_id = $1`,
    [signingRequestId]
  )
  const total = parseInt(rows[0].total, 10)
  const done = parseInt(rows[0].done, 10)
  return total > 0 && total === done
}

export async function getNextPendingSigner(signingRequestId: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT * FROM esign_signing_request_signers
     WHERE signing_request_id = $1
       AND status = 'pending'
     ORDER BY sign_order ASC
     LIMIT 1`,
    [signingRequestId]
  )
  return rows[0] ?? null
}
