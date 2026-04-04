import { randomInt } from 'crypto'
import { query } from './db'

export function generateOtp(): string {
  return String(randomInt(100000, 999999))
}

export async function createOtp(signingRequestId: string, email: string): Promise<string> {
  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await query(
    `INSERT INTO esign_otp_codes (signing_request_id, email, code, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [signingRequestId, email.toLowerCase().trim(), code, expiresAt.toISOString()]
  )

  return code
}

export async function verifyOtp(
  signingRequestId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const { rows } = await query(
    `SELECT id, code, attempts, expires_at, verified_at
     FROM esign_otp_codes
     WHERE signing_request_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [signingRequestId]
  )

  if (rows.length === 0) return { valid: false, error: 'No OTP found' }

  const otp = rows[0]

  if (otp.verified_at) return { valid: true } // Already verified
  if (otp.attempts >= 3) return { valid: false, error: 'Too many attempts. Contact the sender.' }
  if (new Date(otp.expires_at) < new Date()) return { valid: false, error: 'Code expired. Request a new one.' }

  // Increment attempts
  await query('UPDATE esign_otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id])

  if (otp.code !== code) {
    return { valid: false, error: `Incorrect code. ${2 - otp.attempts} attempts remaining.` }
  }

  // Mark as verified
  await query('UPDATE esign_otp_codes SET verified_at = NOW() WHERE id = $1', [otp.id])

  return { valid: true }
}

export async function isOtpVerified(signingRequestId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT verified_at FROM esign_otp_codes
     WHERE signing_request_id = $1 AND verified_at IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [signingRequestId]
  )
  return rows.length > 0
}
