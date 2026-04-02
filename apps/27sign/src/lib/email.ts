import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(
  to: string,
  template: { subject: string; html: string }
): Promise<boolean> {
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
