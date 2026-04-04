import { Resend } from 'resend'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendEmail(
  to: string,
  template: { subject: string; html: string }
): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[esign/email] RESEND_API_KEY not set — skipping send')
    return false
  }
  try {
    const { error } = await resend.emails.send({
      from: 'Relentify E-Sign <sign@relentify.com>',
      to,
      subject: template.subject,
      html: template.html,
    })
    return !error
  } catch {
    return false
  }
}
