import Link from 'next/link';
export default function PaymentCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-dark)] px-4">
      <div className="max-w-md w-full text-center bg-[var(--theme-primary)]/5 backdrop-blur-xl border border-[var(--theme-border)] rounded-cinematic p-12 shadow-cinematic">
        <div className="w-20 h-20 bg-[var(--theme-primary)]/10 border-2 border-[var(--theme-border)] rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">↩</span></div>
        <h1 className="text-2xl font-black text-[var(--theme-text)] mb-3">Payment Cancelled</h1>
        <p className="text-[var(--theme-text-muted)] font-medium mb-8">Your payment was not completed. You can try again using the payment link.</p>
        <Link href="/" className="text-[var(--theme-accent)] hover:opacity-80 font-black text-[10px] uppercase tracking-widest no-underline">Go to Relentify →</Link>
      </div>
    </div>
  );
}
