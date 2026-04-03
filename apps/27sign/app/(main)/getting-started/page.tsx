import { PageHeader, Card, CardHeader, CardContent, CardTitle, Button } from '@relentify/ui'
import { ArrowRight, Key, Code2, Send, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const steps = [
  {
    icon: Key,
    title: '1. Generate an API Key',
    description: 'Go to Settings → API Keys and generate your first key. You\'ll need this to authenticate API calls.',
    link: '/settings',
    linkText: 'Go to Settings',
  },
  {
    icon: Code2,
    title: '2. Create a Signing Request',
    description: 'Upload a PDF with signature fields in one call. Use pageNumber: -1 for "last page". For text-only confirmations, omit the file.',
    code: `# Document signing (one call)
curl -X POST https://esign.relentify.com/api/v1/requests \\
  -H "Authorization: Bearer rs_live_YOUR_KEY" \\
  -F "file=@contract.pdf" \\
  -F 'title=Tenancy Agreement — 14 Oak Lane' \\
  -F 'bodyText=I acknowledge this agreement.' \\
  -F 'signers=[{"email":"tenant@example.com","name":"Jane"}]' \\
  -F 'fields=[{"signerEmail":"tenant@example.com","fieldType":"signature","pageNumber":-1,"xPercent":55,"yPercent":82,"widthPercent":30,"heightPercent":8}]' \\
  -F "callbackUrl=https://your-app.com/webhooks/signed" \\
  -F "callbackSecret=whsec_your_secret"`,
  },
  {
    icon: Send,
    title: '3. Send the Signing URL',
    description: 'Send the signingUrl from the response to your signer — via email, SMS, or in-app. They\'ll verify their identity with an OTP, then draw or upload their signature.',
  },
  {
    icon: CheckCircle2,
    title: '4. Receive the Webhook',
    description: 'When the signer completes, we POST the signature image + metadata to your callbackUrl. Verify the X-Signature-256 HMAC header for security.',
    link: '/docs',
    linkText: 'See API Docs',
  },
]

export default function GettingStartedPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader supertitle="GETTING STARTED" title="" className="mb-0" />

      <p className="text-[var(--theme-text-muted)] text-lg leading-relaxed">
        Integrate legally binding digital signatures into your app in 4 steps.
        Each signature includes email OTP verification, a hash-chained audit trail, and an RFC 3161 third-party timestamp.
      </p>

      {steps.map((step, i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/10 flex items-center justify-center shrink-0">
                <step.icon size={18} className="text-[var(--theme-accent)]" />
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="font-bold text-[var(--theme-text)] text-lg">{step.title}</h3>
                <p className="text-[var(--theme-text-muted)] text-sm leading-relaxed">{step.description}</p>
                {step.code && (
                  <pre className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg p-4 font-mono text-xs text-[var(--theme-text)] overflow-x-auto whitespace-pre-wrap">
                    {step.code}
                  </pre>
                )}
                {step.link && (
                  <Link href={step.link}>
                    <Button variant="outline" className="text-xs mt-2">
                      {step.linkText} <ArrowRight size={12} className="ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
