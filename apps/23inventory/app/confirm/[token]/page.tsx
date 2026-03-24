'use client';

import { useEffect, useState } from 'react'
import { use } from 'react'
import { CheckCircle2, XCircle, Loader2, ClipboardList, ShieldCheck } from 'lucide-react'
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Badge,
  ThemeProvider,
  NoiseOverlay
} from '@relentify/ui'

export default function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [status, setStatus] = useState<'loading' | 'ready' | 'confirming' | 'done' | 'error'>('loading')
  const [inventory, setInventory] = useState<{ propertyAddress: string; type: string; createdBy: string; createdAt: string; tenantConfirmed: boolean } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch(`/api/confirm/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setInventory(data)
        setStatus(data.tenantConfirmed ? 'done' : 'ready')
      })
      .catch(() => { setErrorMsg('This verification sequence is invalid or has expired.'); setStatus('error') })
  }, [token])

  async function confirm() {
    setStatus('confirming')
    try {
      const res = await fetch(`/api/confirm/${token}`, { method: 'POST' })
      if (res.status === 409) { setStatus('done'); return }
      if (!res.ok) throw new Error()
      setStatus('done')
    } catch {
      setErrorMsg('Attestation failed. Please retry.')
      setStatus('error')
    }
  }

  return (
    <ThemeProvider initialPreset="D">
      <div className="min-h-screen bg-[var(--theme-background)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <NoiseOverlay />
        
        <div className="max-w-lg w-full space-y-12 relative z-10">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <ClipboardList size={32} className="text-[var(--theme-accent)]" />
              <span className="text-[var(--theme-text)] font-bold text-3xl tracking-tighter font-sans uppercase">Relentify</span>
            </div>
            <p className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-[0.4em]">Asset Verification Protocol</p>
          </div>

          <Card className="shadow-cinematic overflow-hidden">
            {status === 'loading' && (
              <CardContent className="p-24 text-center">
                <Loader2 size={40} className="animate-spin text-[var(--theme-accent)] mx-auto mb-6" />
                <div className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest">Initialising Secure Link...</div>
              </CardContent>
            )}

            {status === 'error' && (
              <CardContent className="p-20 text-center space-y-6">
                <div className="w-20 h-20 bg-[var(--theme-destructive)]/10 rounded-full flex items-center justify-center mx-auto border border-[var(--theme-destructive)]/20">
                  <XCircle size={40} className="text-[var(--theme-destructive)]" />
                </div>
                <div className="space-y-2">
                  <div className="font-bold text-xl text-[var(--theme-text)] tracking-tight">Access Denied</div>
                  <div className="text-[var(--theme-text-muted)] text-[var(--theme-text-85)]">{errorMsg}</div>
                </div>
                <Button variant="outline" onClick={() => window.location.reload()} className="w-full h-12 rounded-xl">Retry Sequence</Button>
              </CardContent>
            )}

            {(status === 'ready' || status === 'confirming') && inventory && (
              <>
                <div className="bg-[var(--theme-border)] border-b border-[var(--theme-border)] p-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={inventory.type === 'check-in' ? 'accent' : 'warning'}>{inventory.type}</Badge>
                    <span className="text-[var(--theme-text-10)] font-mono text-[var(--theme-text-dim)] uppercase tracking-widest">{new Date(inventory.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--theme-text)] tracking-tight leading-tight">{inventory.propertyAddress}</h2>
                </div>
                <CardContent className="p-10 space-y-8">
                  <p className="text-[var(--theme-text-85)] text-[var(--theme-text-muted)] leading-relaxed italic">
                    I, the undersigned, acknowledge the physical state of the property as documented by <strong>{inventory.createdBy}</strong>.
                  </p>
                  
                  <div className="bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/20 rounded-cinematic p-6 flex gap-4 items-start">
                    <ShieldCheck className="text-[var(--theme-accent)] shrink-0" size={20} />
                    <div className="space-y-1">
                      <p className="text-[var(--theme-text-10)] font-mono font-bold text-[var(--theme-accent)] uppercase tracking-widest leading-none">Legal Attestation</p>
                      <p className="text-[var(--theme-text-70)] text-[var(--theme-text-dim)] leading-relaxed">By executing this protocol, your unique biometric footprint (IP & Timestamp) will be permanently recorded as an immutable witness to this inventory.</p>
                    </div>
                  </div>

                  <Button 
                    onClick={confirm} 
                    disabled={status === 'confirming'}
                    variant="primary"
                    className="w-full h-16 rounded-cinematic shadow-cinematic shadow-[var(--theme-accent)]/20 text-[var(--theme-text-85)] font-bold uppercase tracking-[0.1em]"
                  >
                    {status === 'confirming' ? (
                      <><Loader2 size={20} className="animate-spin mr-3" /> Processing...</>
                    ) : (
                      <><CheckCircle2 size={20} className="mr-3" /> Authorise & Verify</>
                    )}
                  </Button>
                </CardContent>
              </>
            )}

            {status === 'done' && (
              <CardContent className="p-24 text-center space-y-8">
                <div className="w-24 h-24 bg-[var(--theme-success)]/10 rounded-full flex items-center justify-center mx-auto border border-[var(--theme-success)]/20">
                  <CheckCircle2 size={48} className="text-[var(--theme-success)]" />
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-[var(--theme-text)] tracking-tighter">Verified</div>
                  <div className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-[0.2em]">Protocol Successfully Executed</div>
                </div>
                <div className="pt-4">
                  <p className="text-[var(--theme-text-70)] text-[var(--theme-text-dim)]/50 leading-relaxed max-w-[var(--theme-size-200)] mx-auto">Your digital signature has been synchronised with the property ledger.</p>
                </div>
              </CardContent>
            )}
          </Card>
          
          <div className="text-center">
            <p className="text-[var(--theme-text-10)] font-mono text-[var(--theme-text-dim)]/50 uppercase tracking-[0.3em]">Securely Powered by Relentify Neural Grid</p>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
