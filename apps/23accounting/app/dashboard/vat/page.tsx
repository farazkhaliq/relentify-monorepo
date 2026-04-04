'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { toast, Toaster } from '@relentify/ui'

interface Obligation {
  start: string
  end: string
  due: string
  status: 'O' | 'F'
  periodKey: string
}

interface VatBoxes {
  box1: number; box2: number; box3: number; box4: number; box5: number
  box6: number; box7: number; box8: number; box9: number
}

function VatContent() {
  const params = useSearchParams()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [vrn, setVrn] = useState<string | null>(null)
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [selected, setSelected] = useState<Obligation | null>(null)
  const [boxes, setBoxes] = useState<VatBoxes | null>(null)
  const [loading, setLoading] = useState(true)
  const [calcLoading, setCalcLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Get user's HMRC connection status + VRN
      const ur = await fetch('/api/user')
      const ud = await ur.json()
      const user = ud.user
      setVrn(user.vat_number || null)
      setConnected(!!user.hmrc_access_token)

      if (user.hmrc_access_token && user.vat_number) {
        const or = await fetch('/api/hmrc/obligations')
        const od = await or.json()
        if (od.obligations) setObligations(od.obligations)
        else if (od.error === 'not_connected') setConnected(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const status = params.get('hmrc')
    if (status === 'connected') toast('HMRC connected successfully', 'success')
    if (status === 'error') toast('HMRC connection failed', 'error')
    if (status === 'denied') toast('HMRC connection was cancelled', 'error')

    // Capture real browser data for HMRC fraud prevention headers.
    // Stored server-side and sent with every HMRC API call.
    try {
      const stored = localStorage.getItem('relentify_device_id')
      const deviceId = stored || crypto.randomUUID()
      if (!stored) localStorage.setItem('relentify_device_id', deviceId)

      const offsetMins = -new Date().getTimezoneOffset()
      const sign = offsetMins >= 0 ? '+' : '-'
      const hh = String(Math.floor(Math.abs(offsetMins) / 60)).padStart(2, '0')
      const mm = String(Math.abs(offsetMins) % 60).padStart(2, '0')
      const timezone = `UTC${sign}${hh}:${mm}`

      const screens = `width=${screen.width}&height=${screen.height}&scaling-factor=${window.devicePixelRatio ?? 1}&colour-depth=${screen.colorDepth}`
      const windowSize = `width=${window.innerWidth}&height=${window.innerHeight}`

      fetch('/api/hmrc/client-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, screens, windowSize, timezone }),
      }).catch(() => {}) // non-critical — best effort
    } catch {
      // Ignore if browser APIs unavailable
    }
  }, [load, params])

  async function selectObligation(ob: Obligation) {
    setSelected(ob)
    setBoxes(null)
    setCalcLoading(true)
    try {
      const r = await fetch(`/api/hmrc/vat/calculate?from=${ob.start}&to=${ob.end}`)
      const d = await r.json()
      setBoxes(d)
    } catch {
      toast('Failed to calculate VAT return', 'error')
    } finally {
      setCalcLoading(false)
    }
  }

  async function submitReturn() {
    if (!selected || !boxes) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/hmrc/vat/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: selected.periodKey, from: selected.start, to: selected.end }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast('VAT return submitted to HMRC ✓', 'success')
      setSelected(null)
      setBoxes(null)
      load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Submit failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect from HMRC?')) return
    await fetch('/api/hmrc/disconnect', { method: 'DELETE' })
    setConnected(false)
    setObligations([])
    toast('HMRC disconnected', 'info')
  }

  const openObs = obligations.filter(o => o.status === 'O')
  const doneObs = obligations.filter(o => o.status === 'F')

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--theme-text)]">VAT Returns</h1>
          <p className="text-[var(--theme-text-muted)] text-sm mt-1">Submit VAT returns to HMRC via Making Tax Digital</p>
        </div>
        {connected && (
          <button onClick={disconnect} className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-destructive)] bg-transparent border-none cursor-pointer">
            Disconnect HMRC
          </button>
        )}
      </div>

      {!vrn && (
        <div className="bg-[var(--theme-warning)]/10 border border-[var(--theme-warning)]/20 rounded-cinematic p-5">
          <p className="text-[var(--theme-warning)] font-bold text-sm">VAT number required</p>
          <p className="text-[var(--theme-warning)] text-xs mt-1">Add your VAT number in <a href="/dashboard/settings" className="underline">Settings → Business Details</a> before connecting to HMRC.</p>
        </div>
      )}

      {vrn && !connected && (
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-8 text-center">
          <div className="w-14 h-14 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h2 className="text-lg font-black text-[var(--theme-text)] mb-2">Connect to HMRC</h2>
          <p className="text-[var(--theme-text-muted)] text-sm mb-6 max-w-sm mx-auto">
            Authorise Relentify to submit VAT returns on your behalf via HMRC&apos;s Making Tax Digital service.
          </p>
          <a href="/api/hmrc/connect" className="inline-block px-8 py-3 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all no-underline">
            Connect to HMRC →
          </a>
        </div>
      )}

      {connected && !selected && (
        <>
          <div className="bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 rounded-cinematic px-5 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--theme-accent)] animate-pulse"/>
            <span className="text-[var(--theme-accent)] text-sm font-bold">Connected to HMRC — VRN: {vrn}</span>
          </div>

          {openObs.length > 0 && (
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6">
              <h2 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-4">Open Obligations</h2>
              <div className="space-y-3">
                {openObs.map(ob => (
                  <button key={ob.periodKey} onClick={() => selectObligation(ob)}
                    className="w-full flex items-center justify-between p-4 bg-[var(--theme-card)] rounded-cinematic hover:bg-[var(--theme-accent)]/10 transition-colors text-left border border-transparent hover:border-[var(--theme-accent)]/20 cursor-pointer">
                    <div>
                      <p className="font-black text-[var(--theme-text)] text-sm">{ob.start} → {ob.end}</p>
                      <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">Due: {ob.due}</p>
                    </div>
                    <span className="px-3 py-1 bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] text-[10px] font-black uppercase tracking-widest rounded-full">
                      Open
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {openObs.length === 0 && (
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-8 text-center">
              <p className="text-[var(--theme-text-muted)] text-sm">No open VAT obligations. All returns are up to date.</p>
            </div>
          )}

          {doneObs.length > 0 && (
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6">
              <h2 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-4">Submitted Returns</h2>
              <div className="space-y-2">
                {doneObs.map(ob => (
                  <div key={ob.periodKey} className="flex items-center justify-between p-4 bg-[var(--theme-card)] rounded-cinematic">
                    <div>
                      <p className="font-bold text-[var(--theme-text)] text-sm">{ob.start} → {ob.end}</p>
                    </div>
                    <span className="px-3 py-1 bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] text-[10px] font-black uppercase tracking-widest rounded-full">
                      Filed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {connected && selected && (
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSelected(null); setBoxes(null) }} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] bg-transparent border-none cursor-pointer">
              ←
            </button>
            <div>
              <h2 className="font-black text-[var(--theme-text)]">VAT Return: {selected.start} → {selected.end}</h2>
              <p className="text-xs text-[var(--theme-text-muted)]">Due: {selected.due} · Period key: {selected.periodKey}</p>
            </div>
          </div>

          {calcLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <svg className="w-5 h-5 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span className="text-[var(--theme-text-muted)] text-sm">Calculating from your records…</span>
            </div>
          )}

          {boxes && (
            <>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {[
                  { n: 1, label: 'VAT due on sales (output tax)', val: `£${boxes.box1.toFixed(2)}`, highlight: true },
                  { n: 2, label: 'VAT due on EU acquisitions', val: `£${boxes.box2.toFixed(2)}` },
                  { n: 3, label: 'Total VAT due', val: `£${boxes.box3.toFixed(2)}`, bold: true },
                  { n: 4, label: 'VAT reclaimed on purchases (input tax)', val: `£${boxes.box4.toFixed(2)}` },
                  { n: 5, label: 'Net VAT to pay / reclaim', val: `£${boxes.box5.toFixed(2)}`, bold: true, highlight: true },
                  { n: 6, label: 'Total sales excl. VAT (whole £)', val: `£${boxes.box6}` },
                  { n: 7, label: 'Total purchases excl. VAT (whole £)', val: `£${boxes.box7}` },
                  { n: 8, label: 'Total EC goods supplied excl. VAT', val: `£${boxes.box8}` },
                  { n: 9, label: 'Total EC acquisitions excl. VAT', val: `£${boxes.box9}` },
                ].map(row => (
                  <div key={row.n} className={`flex items-center justify-between p-3 rounded-cinematic ${row.highlight ? 'bg-[var(--theme-accent)]/10' : 'bg-[var(--theme-card)]'}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[var(--theme-border)]/30 text-xs font-black text-[var(--theme-text)] flex items-center justify-center">{row.n}</span>
                      <span className={`text-sm ${row.bold ? 'font-black text-[var(--theme-text)]' : 'text-[var(--theme-text-muted)]'}`}>{row.label}</span>
                    </div>
                    <span className={`font-black text-sm ${row.highlight ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text)]'}`}>{row.val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--theme-warning)]/10 border border-[var(--theme-warning)]/20 rounded-cinematic p-4 mb-6">
                <p className="text-[var(--theme-warning)] text-xs font-bold">Before submitting</p>
                <p className="text-[var(--theme-warning)] text-xs mt-1">Once submitted to HMRC this cannot be undone. Ensure all invoices and bills for this period are recorded correctly.</p>
              </div>

              <button onClick={submitReturn} disabled={submitting}
                className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer">
                {submitting ? 'Submitting…' : 'Submit to HMRC →'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function VatPage() {
  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Suspense>
          <VatContent />
        </Suspense>
      </main>
    </div>
  )
}
