export default function VerifyPage() {
  // Verification is handled server-side by /api/portal/verify
  // This page shows a fallback message
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-background)]">
      <div className="max-w-sm w-full p-8 text-center">
        <h1 className="text-xl font-bold mb-2">Verifying...</h1>
        <p className="text-sm text-[var(--theme-text-muted)]">If you are not redirected, your link may have expired.</p>
        <a href="/portal/login" className="text-sm text-[var(--theme-primary)] underline mt-4 block">Request a new link</a>
      </div>
    </div>
  )
}
