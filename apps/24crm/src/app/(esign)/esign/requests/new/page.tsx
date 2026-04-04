'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label, Badge } from '@relentify/ui'
import { ArrowLeft, ArrowRight, Send, Plus, X, FileText, Upload, Copy, Check, Loader2, Users, Eye } from 'lucide-react'
import Link from 'next/link'
import FieldPlacer, { type PlacedField } from '@/components/esign/FieldPlacer'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNER_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899']

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Signer {
  email: string
  name: string
  color: string
}

interface CreateResult {
  id: string
  token: string
  signingUrl: string
  status: string
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, hasDocument }: { current: number; hasDocument: boolean }) {
  const steps = hasDocument
    ? [{ n: 1, label: 'Upload' }, { n: 2, label: 'Place Fields' }, { n: 3, label: 'Review & Send' }]
    : [{ n: 1, label: 'Details' }, { n: 2, label: 'Review & Send' }]

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          {i > 0 && (
            <div
              className="w-8 h-px"
              style={{ backgroundColor: current >= s.n ? 'var(--theme-accent)' : 'var(--theme-border)' }}
            />
          )}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                backgroundColor: current >= s.n ? 'var(--theme-accent)' : 'var(--theme-border)',
                color: current >= s.n ? 'white' : 'var(--theme-text-muted)',
              }}
            >
              {current > s.n ? <Check size={12} /> : s.n}
            </div>
            <span
              className="text-xs font-medium hidden sm:inline"
              style={{ color: current >= s.n ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
            >
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function NewRequestPage() {
  const router = useRouter()

  // Wizard state
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'document' | 'text' | null>(null) // null = choosing

  // Shared form state
  const [title, setTitle] = useState('')
  const [bodyText, setBodyText] = useState('')

  // Document mode state
  const [file, setFile] = useState<File | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [fields, setFields] = useState<PlacedField[]>([])

  // Signers
  const [signers, setSigners] = useState<Signer[]>([
    { email: '', name: '', color: SIGNER_COLORS[0] },
  ])
  const [signingMode, setSigningMode] = useState<'parallel' | 'sequential'>('parallel')

  // Result / flow state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateResult | null>(null)
  const [copied, setCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Signer management
  // ---------------------------------------------------------------------------

  const addSigner = useCallback(() => {
    setSigners(prev => [
      ...prev,
      { email: '', name: '', color: SIGNER_COLORS[prev.length % SIGNER_COLORS.length] },
    ])
  }, [])

  const removeSigner = useCallback((index: number) => {
    if (signers.length <= 1) return
    setSigners(prev => prev.filter((_, i) => i !== index))
  }, [signers.length])

  const updateSigner = useCallback((index: number, patch: Partial<Signer>) => {
    setSigners(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }, [])

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.includes('pdf')) {
      setError('Only PDF files are supported')
      return
    }
    setFile(selectedFile)
    setError('')

    // Read file for preview
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setPdfData(base64)
      // Rough page count estimate: count /Type /Page occurrences
      // This is a placeholder; DocumentViewer will handle the actual rendering
      setPageCount(1)
    }
    reader.readAsDataURL(selectedFile)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }, [handleFileSelect])

  // ---------------------------------------------------------------------------
  // Step 1 validation (document mode)
  // ---------------------------------------------------------------------------

  const canProceedStep1Document = title.trim() && file && signers[0]?.email.trim()
  const canProceedStep1Text = signers[0]?.email.trim() && title.trim() && bodyText.trim()

  // ---------------------------------------------------------------------------
  // Upload document + create request (transition from step 1 to 2 in doc mode)
  // ---------------------------------------------------------------------------

  async function handleUploadAndCreateRequest() {
    if (!file || !title.trim() || !signers[0]?.email.trim()) return
    setLoading(true)
    setError('')

    try {
      // 1. Create signing request
      const createRes = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerEmail: signers[0].email.trim().toLowerCase(),
          signerName: signers[0].name.trim() || undefined,
          title: title.trim(),
          bodyText: bodyText.trim() || 'Please review and sign this document.',
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create request')

      // 2. Upload the document
      const formData = new FormData()
      formData.append('file', file)
      formData.append('signingRequestId', createData.id)

      const uploadRes = await fetch('/api/esign/documents/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload document')

      setDocumentId(uploadData.id)
      if (uploadData.pageCount) setPageCount(uploadData.pageCount)
      setResult({ id: createData.id, token: createData.token, signingUrl: createData.signingUrl, status: 'pending' })

      // Fetch the PDF back for the field placer
      if (uploadData.id) {
        const pdfRes = await fetch(`/api/documents/${uploadData.id}/pdf`)
        if (pdfRes.ok) {
          const pdfJson = await pdfRes.json()
          if (pdfJson.pdf) setPdfData(pdfJson.pdf)
          if (pdfJson.pageCount) setPageCount(pdfJson.pageCount)
        }
      }

      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Save fields (transition from step 2 to 3)
  // ---------------------------------------------------------------------------

  async function handleSaveFields() {
    if (!documentId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/documents/${documentId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save fields')

      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Send (text-only flow)
  // ---------------------------------------------------------------------------

  async function handleSendTextOnly() {
    if (!signers[0]?.email.trim() || !title.trim() || !bodyText.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerEmail: signers[0].email.trim().toLowerCase(),
          signerName: signers[0].name.trim() || undefined,
          title: title.trim(),
          bodyText: bodyText.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create request')

      setResult(data)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Copy URL
  // ---------------------------------------------------------------------------

  function copyUrl() {
    if (result?.signingUrl) {
      navigator.clipboard.writeText(result.signingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ---------------------------------------------------------------------------
  // Render: Mode selection (initial state)
  // ---------------------------------------------------------------------------

  if (!mode) {
    return (
      <div className="space-y-8 max-w-2xl">
        <div className="space-y-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-[var(--theme-text)] tracking-tight">New Signing Request</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer transition-all hover:shadow-lg group"
            onClick={() => setMode('document')}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-colors"
                style={{ backgroundColor: 'var(--theme-accent)', opacity: 0.1 }}
              >
                <Upload size={28} style={{ color: 'var(--theme-accent)' }} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-[var(--theme-text)]">Upload Document</h3>
                <p className="text-sm text-[var(--theme-text-muted)]">
                  Upload a PDF and place signature fields on specific pages
                </p>
              </div>
              <Badge className="text-[10px]">Recommended</Badge>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:shadow-lg group"
            onClick={() => { setMode('text'); setStep(1) }}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--theme-border)' }}
              >
                <FileText size={28} style={{ color: 'var(--theme-text-muted)' }} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-[var(--theme-text)]">Quick Text Request</h3>
                <p className="text-sm text-[var(--theme-text-muted)]">
                  Type legal text and collect a single signature
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Success / Result
  // ---------------------------------------------------------------------------

  if (result && ((mode === 'document' && step === 3) || (mode === 'text' && step === 3))) {
    return (
      <div className="space-y-8 max-w-2xl">
        <div className="space-y-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
          </Link>
        </div>

        <Card className="border-[var(--theme-success)]/30 bg-[var(--theme-success)]/5">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-[var(--theme-text)]">Signing request created</h3>
              <p className="text-sm text-[var(--theme-text-muted)]">
                Send this link to the signer. They will verify their email and sign digitally.
              </p>
            </div>

            {mode === 'document' && (
              <div className="flex flex-wrap gap-3">
                <Badge className="text-xs">{file?.name}</Badge>
                {fields.length > 0 && (
                  <Badge variant="outline" className="text-xs">{fields.length} field{fields.length !== 1 ? 's' : ''} placed</Badge>
                )}
                <Badge variant="outline" className="text-xs">{signers.filter(s => s.email).length} signer{signers.filter(s => s.email).length !== 1 ? 's' : ''}</Badge>
              </div>
            )}

            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-lg px-4 py-3 font-mono text-sm text-[var(--theme-text)] break-all">
                {result.signingUrl}
              </code>
              <button
                onClick={copyUrl}
                className="p-3 hover:bg-[var(--theme-border)] rounded-lg transition-colors shrink-0"
              >
                {copied ? <Check size={16} className="text-[var(--theme-success)]" /> : <Copy size={16} />}
              </button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setMode(null)
                  setStep(1)
                  setTitle('')
                  setBodyText('')
                  setFile(null)
                  setPdfData(null)
                  setDocumentId(null)
                  setFields([])
                  setSigners([{ email: '', name: '', color: SIGNER_COLORS[0] }])
                  setResult(null)
                  setError('')
                }}
                className="text-xs"
              >
                Create Another
              </Button>
              <Link href="/">
                <Button variant="primary" className="text-xs">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Text-only flow (simplified, same as original)
  // ---------------------------------------------------------------------------

  if (mode === 'text') {
    return (
      <div className="space-y-8 max-w-2xl">
        <div className="space-y-4">
          <button
            onClick={() => setMode(null)}
            className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back
          </button>
          <h1 className="text-2xl font-bold text-[var(--theme-text)] tracking-tight">Quick Text Request</h1>
        </div>

        <Card>
          <CardHeader className="border-b border-[var(--theme-border)]">
            <CardTitle className="text-lg">Request Details</CardTitle>
            <CardDescription>Create a signing request and get a link to share</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <form
              onSubmit={e => { e.preventDefault(); handleSendTextOnly() }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Signer Email *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="tenant@example.com"
                    value={signers[0].email}
                    onChange={e => updateSigner(0, { email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signer Name</Label>
                  <Input
                    placeholder="Jane Doe (optional)"
                    value={signers[0].name}
                    onChange={e => updateSigner(0, { name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Document Title *</Label>
                <Input
                  required
                  placeholder="e.g. Property Inventory - 14 Oak Lane"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Legal Text *</Label>
                <textarea
                  required
                  rows={4}
                  placeholder="I, the undersigned, acknowledge..."
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-[var(--theme-destructive)] text-sm font-bold">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading || !canProceedStep1Text}
                variant="primary"
                className="w-full h-12 text-xs"
              >
                {loading ? (
                  <><Loader2 size={14} className="mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Send size={14} className="mr-2" /> Create Signing Request</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Document wizard flow
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-4">
        <button
          onClick={() => {
            if (step === 1) {
              setMode(null)
            } else {
              setStep(step - 1)
            }
          }}
          className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[10px] uppercase tracking-widest"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          {step === 1 ? 'Back' : `Step ${step - 1}`}
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--theme-text)] tracking-tight">New Document Request</h1>
          <StepIndicator current={step} hasDocument />
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg p-3 text-sm font-medium"
          style={{
            backgroundColor: 'var(--theme-destructive)',
            color: 'white',
            opacity: 0.9,
          }}
        >
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Step 1: Upload + basic details                                       */}
      {/* ------------------------------------------------------------------- */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload zone */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="border-b border-[var(--theme-border)]">
                <CardTitle className="text-base">Upload Document</CardTitle>
                <CardDescription>Drag and drop a PDF or click to browse</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {!file ? (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors hover:border-[var(--theme-accent)]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <Upload size={40} className="mx-auto mb-4" style={{ color: 'var(--theme-text-muted)' }} />
                    <p className="text-sm font-medium text-[var(--theme-text)]">
                      Drop your PDF here, or click to browse
                    </p>
                    <p className="text-xs mt-1 text-[var(--theme-text-muted)]">PDF files only</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleFileSelect(f)
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{ backgroundColor: 'var(--theme-accent)', opacity: 0.08 }}
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'var(--theme-accent)', opacity: 0.15 }}
                    >
                      <FileText size={24} style={{ color: 'var(--theme-accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--theme-text)] truncate">{file.name}</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => { setFile(null); setPdfData(null) }}
                      className="p-2 rounded-lg transition-colors hover:bg-[var(--theme-border)]"
                    >
                      <X size={16} style={{ color: 'var(--theme-text-muted)' }} />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b border-[var(--theme-border)]">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Document Title *</Label>
                  <Input
                    placeholder="e.g. Tenancy Agreement"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Message (optional)</Label>
                  <textarea
                    rows={2}
                    placeholder="Optional message for the signer..."
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] text-xs resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Signers */}
            <Card>
              <CardHeader className="border-b border-[var(--theme-border)]">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Signers</CardTitle>
                  <button
                    onClick={addSigner}
                    className="p-1 rounded transition-colors hover:bg-[var(--theme-border)]"
                  >
                    <Plus size={14} style={{ color: 'var(--theme-text-muted)' }} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {signers.map((signer, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full mt-2.5 flex-shrink-0"
                      style={{ backgroundColor: signer.color }}
                    />
                    <div className="flex-1 space-y-1.5">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={signer.email}
                        onChange={e => updateSigner(i, { email: e.target.value })}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Name (optional)"
                        value={signer.name}
                        onChange={e => updateSigner(i, { name: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    {signers.length > 1 && (
                      <button
                        onClick={() => removeSigner(i)}
                        className="p-1 rounded mt-1.5 transition-colors hover:bg-[var(--theme-border)]"
                      >
                        <X size={12} style={{ color: 'var(--theme-text-muted)' }} />
                      </button>
                    )}
                  </div>
                ))}

                {signers.length >= 2 && (
                  <div
                    className="flex items-center gap-2 pt-2 border-t"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <Users size={12} style={{ color: 'var(--theme-text-muted)' }} />
                    <span className="text-xs text-[var(--theme-text-muted)]">Signing order:</span>
                    <div className="flex gap-1">
                      {(['parallel', 'sequential'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setSigningMode(m)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors capitalize"
                          style={{
                            backgroundColor: signingMode === m ? 'var(--theme-accent)' : 'var(--theme-border)',
                            color: signingMode === m ? 'white' : 'var(--theme-text-muted)',
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next button */}
            <Button
              variant="primary"
              className="w-full h-12 text-xs"
              disabled={!canProceedStep1Document || loading}
              onClick={handleUploadAndCreateRequest}
            >
              {loading ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><ArrowRight size={14} className="mr-2" /> Upload & Continue</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Step 2: Place fields                                                 */}
      {/* ------------------------------------------------------------------- */}
      {step === 2 && pdfData && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-[var(--theme-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Place Signature Fields</CardTitle>
                  <CardDescription>
                    Select a field type from the toolbar, then click on the document to place it.
                    Drag to reposition, resize from the corner.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {fields.length} field{fields.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <FieldPlacer
                pdfData={pdfData}
                pageCount={pageCount}
                signers={signers.filter(s => s.email.trim()).map(s => ({
                  email: s.email.trim().toLowerCase(),
                  name: s.name.trim() || undefined,
                  color: s.color,
                }))}
                fields={fields}
                onFieldsChange={setFields}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="text-xs">
              <ArrowLeft size={14} className="mr-2" /> Back
            </Button>
            <Button
              variant="primary"
              className="text-xs"
              disabled={loading}
              onClick={handleSaveFields}
            >
              {loading ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Saving...</>
              ) : (
                <><ArrowRight size={14} className="mr-2" /> Review & Send</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Step 3: Review (document mode — shows summary before marking done)   */}
      {/* Note: result is already set from step 1, so we show success here     */}
      {/* ------------------------------------------------------------------- */}
      {step === 3 && !result && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: 'var(--theme-accent)' }} />
            <p className="text-[var(--theme-text-muted)]">Preparing...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
