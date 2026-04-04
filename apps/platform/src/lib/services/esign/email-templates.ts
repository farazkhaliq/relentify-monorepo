const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

function baseTemplate(header: { title: string; subtitle: string }, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, sans-serif; background: #F8F9FB; margin: 0; padding: 40px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <div style="background: #000; color: #fff; padding: 32px 40px;">
      <h1 style="margin: 0; font-size: 20px;">${header.title}</h1>
      <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0;">${header.subtitle}</p>
    </div>
    <div style="padding: 40px;">
      ${body}
    </div>
    <div style="background: #F8F9FB; padding: 20px 40px; border-top: 1px solid rgba(0,0,0,0.04);">
      <p style="color: rgba(0,0,0,0.4); font-size: 12px; margin: 0;">Relentify E-Sign</p>
    </div>
  </div>
</body>
</html>`.trim()
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; background: #10B981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 5rem; font-weight: 600;">${label}</a>`
}

export function signingInviteEmail(params: {
  signerName?: string
  documentTitle: string
  signingUrl: string
}): { subject: string; html: string } {
  const greeting = params.signerName ? `Hi ${params.signerName},` : 'Hello,'

  const body = `
    <p style="margin: 0 0 16px; color: #333;">${greeting}</p>
    <p style="margin: 0 0 24px; color: #333;">You have been invited to sign the following document:</p>
    <div style="background: #F8F9FB; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
      <p style="margin: 0; font-weight: 600; color: #111;">${params.documentTitle}</p>
    </div>
    <p style="margin: 0 0 28px; color: #555;">Click the button below to review and sign the document. You will be asked to verify your email address first.</p>
    ${ctaButton(params.signingUrl, 'Review &amp; Sign Document')}
    <p style="margin: 28px 0 0; color: rgba(0,0,0,0.4); font-size: 12px;">If you were not expecting this, you can safely ignore this email. The link expires in 30 days.</p>
  `

  return {
    subject: `Please sign: ${params.documentTitle}`,
    html: baseTemplate({ title: 'Document Signature Request', subtitle: params.documentTitle }, body),
  }
}

export function signerCompletedEmail(params: {
  signerName: string
  documentTitle: string
}): { subject: string; html: string } {
  const body = `
    <p style="margin: 0 0 16px; color: #333;">Hi ${params.signerName},</p>
    <p style="margin: 0 0 24px; color: #333;">Thank you — your signature has been successfully recorded for the following document:</p>
    <div style="background: #F8F9FB; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
      <p style="margin: 0; font-weight: 600; color: #111;">${params.documentTitle}</p>
    </div>
    <p style="margin: 0; color: #555;">A tamper-evident audit trail has been created. You may receive a copy of the completed document from the sender.</p>
  `

  return {
    subject: `Signature confirmed: ${params.documentTitle}`,
    html: baseTemplate({ title: 'Signature Confirmed', subtitle: 'Your signature has been recorded' }, body),
  }
}

export function signerDeclinedEmail(params: {
  signerName: string
  documentTitle: string
  reason?: string
}): { subject: string; html: string } {
  const reasonBlock = params.reason
    ? `<div style="background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 4px; padding: 12px 16px; margin: 0 0 24px;"><p style="margin: 0; color: #B91C1C; font-size: 14px;"><strong>Reason:</strong> ${params.reason}</p></div>`
    : ''

  const body = `
    <p style="margin: 0 0 16px; color: #333;">Hi ${params.signerName},</p>
    <p style="margin: 0 0 24px; color: #333;">We have recorded that you declined to sign the following document:</p>
    <div style="background: #F8F9FB; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
      <p style="margin: 0; font-weight: 600; color: #111;">${params.documentTitle}</p>
    </div>
    ${reasonBlock}
    <p style="margin: 0; color: #555;">If this was a mistake, please contact the document sender directly.</p>
  `

  return {
    subject: `Signing declined: ${params.documentTitle}`,
    html: baseTemplate({ title: 'Document Declined', subtitle: 'You have declined to sign' }, body),
  }
}

export function allCompletedEmail(params: {
  documentTitle: string
  downloadUrl: string
}): { subject: string; html: string } {
  const body = `
    <p style="margin: 0 0 24px; color: #333;">All parties have signed the following document:</p>
    <div style="background: #F8F9FB; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
      <p style="margin: 0; font-weight: 600; color: #111;">${params.documentTitle}</p>
    </div>
    <p style="margin: 0 0 28px; color: #555;">The signing process is now complete. You can view or download the signed document and its audit trail below.</p>
    ${ctaButton(params.downloadUrl, 'View Completed Document')}
  `

  return {
    subject: `Signing complete: ${params.documentTitle}`,
    html: baseTemplate({ title: 'Signing Complete', subtitle: 'All parties have signed' }, body),
  }
}

export function reminderEmail(params: {
  signerName?: string
  documentTitle: string
  signingUrl: string
}): { subject: string; html: string } {
  const greeting = params.signerName ? `Hi ${params.signerName},` : 'Hello,'

  const body = `
    <p style="margin: 0 0 16px; color: #333;">${greeting}</p>
    <p style="margin: 0 0 24px; color: #555;">This is a friendly reminder that your signature is still required on the following document:</p>
    <div style="background: #F8F9FB; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px;">
      <p style="margin: 0; font-weight: 600; color: #111;">${params.documentTitle}</p>
    </div>
    ${ctaButton(params.signingUrl, 'Sign Now')}
    <p style="margin: 28px 0 0; color: rgba(0,0,0,0.4); font-size: 12px;">If you have already signed or do not wish to sign this document, please contact the sender.</p>
  `

  return {
    subject: `Reminder: please sign "${params.documentTitle}"`,
    html: baseTemplate({ title: 'Signature Reminder', subtitle: 'Your signature is still required' }, body),
  }
}
