'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ShieldCheck, FileSignature } from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@relentify/ui'
import SignatureCapture from '@/components/SignatureCapture'

type Status = 'loading' | 'verifying' | 'ready' | 'signing' | 'done' | 'error'

interface SigningData {
  title: string
  bodyText: string
  signerName: string | null
  status: string
  maskedEmail: string
  otpVerified: boolean
}

export default function SigningClient({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<SigningData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [saveForFuture, setSaveForFuture] = useState(true)
  const [signatureSource, setSignatureSource] = useState<'draw' | 'upload' | 'saved'>('draw')

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(r => {
        if (r.status === 410) throw new Error('This signing link has expired.')
        if (!r.ok) throw new Error('Invalid or expired link.')
        return r.json()
      })
      .then(d => {
        setData(d)
        if (d.status === 'signed') {
          setStatus('done')
        } else if (d.otpVerified) {
          setStatus('ready')
        } else {
          setStatus('verifying')
        }
      })
      .catch(e => { setErrorMsg(e.message); setStatus('error') })
  }, [token])

  async function verifyOtp() {
    if (otpCode.length !== 6) return
    setOtpError('')
    try {
      const res = await fetch(`/api/sign/${token}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      })
      const result = await res.json()
      if (result.verified) {
        setStatus('ready')
      } else {
        setOtpError(result.error || 'Invalid code')
      }
    } catch {
      setOtpError('Verification failed. Please retry.')
    }
  }

  async function submitSignature() {
    if (!signatureData) return
    setStatus('signing')
    try {
      const res = await fetch(`/api/sign/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, source: signatureSource, saveForFuture }),
      })
      if (res.status === 409) { setStatus('done'); return }
      if (!res.ok) throw new Error()
      setStatus('done')
    } catch {
      setErrorMsg('Signing failed. Please retry.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="max-w-lg w-full space-y-12 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <FileSignature size={32} className="text-[var(--theme-accent)]" />
            <span className="text-[var(--theme-text)] font-bold text-3xl tracking-tighter font-sans uppercase">Relentify</span>
          </div>
          <p className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-[0.4em]">Digital Signature Protocol</p>
        </div>

        <Card className="shadow-cinematic overflow-hidden">
          {/* Loading */}
          {status === 'loading' && (
            <CardContent className="p-12 sm:p-24 text-center">
              <Loader2 size={40} className="animate-spin text-[var(--theme-accent)] mx-auto mb-6" />
              <div className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest">Initialising Secure Link...</div>
            </CardContent>
          )}

          {/* Error */}
          {status === 'error' && (
            <CardContent className="p-10 sm:p-20 text-center space-y-6">
              <div className="w-20 h-20 bg-[var(--theme-destructive)]/10 rounded-full flex items-center justify-center mx-auto border border-[var(--theme-destructive)]/20">
                <XCircle size={40} className="text-[var(--theme-destructive)]" />
              </div>
              <div className="space-y-2">
                <div className="font-bold text-xl text-[var(--theme-text)] tracking-tight">Access Denied</div>
                <div className="text-[var(--theme-text-muted)]">{errorMsg}</div>
              </div>
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full h-12 rounded-xl">Retry</Button>
            </CardContent>
          )}

          {/* OTP Verification */}
          {status === 'verifying' && data && (
            <CardContent className="p-6 sm:p-10 space-y-8">
              <div className="text-center space-y-3">
                <ShieldCheck size={40} className="text-[var(--theme-accent)] mx-auto" />
                <h2 className="text-xl font-bold text-[var(--theme-text)] tracking-tight">Verify Your Identity</h2>
                <p className="text-[var(--theme-text-muted)] text-sm">
                  We've sent a 6-digit code to <strong className="text-[var(--theme-text)]">{data.maskedEmail}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
                  autoFocus
                />
                {otpError && (
                  <p className="text-[var(--theme-destructive)] text-sm text-center font-bold">{otpError}</p>
                )}
                <Button
                  onClick={verifyOtp}
                  disabled={otpCode.length !== 6}
                  variant="primary"
                  className="w-full h-14 rounded-xl font-bold uppercase tracking-widest"
                >
                  Verify
                </Button>
              </div>
            </CardContent>
          )}

          {/* Ready to sign */}
          {(status === 'ready' || status === 'signing') && data && (
            <>
              <div className="bg-[var(--theme-border)] border-b border-[var(--theme-border)] p-6 sm:p-10 space-y-4">
                <h2 className="text-2xl font-bold text-[var(--theme-text)] tracking-tight leading-tight">{data.title}</h2>
              </div>
              <CardContent className="p-6 sm:p-10 space-y-8">
                <p className="text-[var(--theme-text-muted)] leading-relaxed italic">
                  {data.bodyText}
                </p>

                <div className="bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/20 rounded-2xl p-6 flex gap-4 items-start">
                  <ShieldCheck className="text-[var(--theme-accent)] shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="font-mono font-bold text-[var(--theme-accent)] uppercase tracking-widest text-xs">Legal Attestation</p>
                    <p className="text-[var(--theme-text-dim)] text-sm leading-relaxed">
                      By signing below, your IP address, timestamp, and browser fingerprint will be permanently recorded as cryptographic evidence.
                    </p>
                  </div>
                </div>

                <SignatureCapture
                  token={token}
                  onSignatureChange={(data, source) => {
                    setSignatureData(data)
                    setSignatureSource(source)
                  }}
                />

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveForFuture}
                    onChange={e => setSaveForFuture(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--theme-border)] text-[var(--theme-accent)]"
                  />
                  <span className="text-sm text-[var(--theme-text-muted)]">Save my signature for future use</span>
                </label>

                <Button
                  onClick={submitSignature}
                  disabled={!signatureData || status === 'signing'}
                  variant="primary"
                  className="w-full h-16 rounded-2xl shadow-cinematic shadow-[var(--theme-accent)]/20 font-bold uppercase tracking-widest"
                >
                  {status === 'signing' ? (
                    <><Loader2 size={20} className="animate-spin mr-3" /> Processing...</>
                  ) : (
                    <><CheckCircle2 size={20} className="mr-3" /> Sign & Confirm</>
                  )}
                </Button>
              </CardContent>
            </>
          )}

          {/* Done */}
          {status === 'done' && (
            <CardContent className="p-12 sm:p-24 text-center space-y-8">
              <div className="w-24 h-24 bg-[var(--theme-success)]/10 rounded-full flex items-center justify-center mx-auto border border-[var(--theme-success)]/20">
                <CheckCircle2 size={48} className="text-[var(--theme-success)]" />
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-[var(--theme-text)] tracking-tighter">Verified</div>
                <div className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-[0.2em]">Signature Successfully Recorded</div>
              </div>
              <p className="text-[var(--theme-text-dim)]/50 leading-relaxed max-w-xs mx-auto text-sm">
                Your digital signature has been cryptographically sealed with a tamper-evident audit trail and third-party timestamp.
              </p>
            </CardContent>
          )}
        </Card>

        <div className="text-center">
          <p className="font-mono text-[var(--theme-text-dim)]/50 uppercase tracking-[0.3em] text-[10px]">Securely Powered by Relentify</p>
        </div>
      </div>
    </div>
  )
}
