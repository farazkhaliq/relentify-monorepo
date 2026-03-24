import { jwtVerify } from 'jose'

export const AUTH_COOKIE_NAME = 'relentify_token'
export const LOGIN_URL = 'https://auth.relentify.com/login'

export async function verifyAuthToken(token: string, secret: string) {
  try {
    const encodedSecret = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, encodedSecret)
    return payload
  } catch (error) {
    return null
  }
}

export function getRedirectUrl(currentUrl: string) {
  const url = new URL(LOGIN_URL)
  url.searchParams.set('redirect', currentUrl)
  return url.toString()
}
