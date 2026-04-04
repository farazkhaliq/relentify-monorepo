import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'
const secret = new TextEncoder().encode(JWT_SECRET)

export interface SignerSessionPayload {
  signerEmail: string
  signingRequestId: string
  signerId: string
  type: 'signer_session'
}

export async function createSignerSession(
  signerEmail: string,
  signingRequestId: string,
  signerId: string
): Promise<string> {
  return new SignJWT({
    signerEmail,
    signingRequestId,
    signerId,
    type: 'signer_session',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

export async function verifySignerSession(
  req: NextRequest
): Promise<SignerSessionPayload | null> {
  const authorization = req.headers.get('authorization')
  if (!authorization || !authorization.startsWith('Bearer ')) return null

  const token = authorization.slice(7)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.type !== 'signer_session') return null
    return payload as unknown as SignerSessionPayload
  } catch {
    return null
  }
}
