import Link from 'next/link';
export default function PaymentSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-dark)] px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[var(--theme-accent)]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="max-w-md w-full text-center bg-[var(--theme-primary)]/5 backdrop-blur-xl border border-[var(--theme-border)] rounded-cinematic p-12 shadow-cinematic relative z-10">
        <div className="w-20 h-20 bg-[var(--theme-accent)]/10 border-2 border-[var(--theme-accent)]/30 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✓</span></div>
        <h1 className="text-2xl font-black text-[var(--theme-text)] mb-3">Payment Successful</h1>
        <p className="text-[var(--theme-text-muted)] font-medium mb-8">Thank you. The invoice has been marked as paid.</p>
        <Link href="/" className="text-[var(--theme-accent)] hover:opacity-80 font-black text-[10px] uppercase tracking-widest no-underline">Go to Relentify →</Link>
      </div>
    </div>
  );
}
