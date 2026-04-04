import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import Link from 'next/link';

export default async function ReceiptsPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const user = await getUserById(auth.userId);
  if (!canAccess(user?.tier, 'capture_bills_receipts')) redirect('/dashboard/upgrade#features');

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-6">Bills &amp; Receipts</h2>

        <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] p-12 sm:p-16 text-center">
          <div className="w-16 h-16 bg-[var(--theme-accent)]/10 rounded-cinematic flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--theme-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[var(--theme-text)] font-black text-lg mb-2">Coming Soon</p>
          <p className="text-[var(--theme-text-muted)] text-sm mb-8 max-w-sm mx-auto">
            Capture receipts by photo or email forward. We&apos;ll extract the details automatically and match them to your bills.
          </p>
          <Link
            href="/dashboard/bills"
            className="inline-block px-8 py-3 bg-[var(--theme-background)] border border-[var(--theme-border)] text-[var(--theme-text)] font-black rounded-cinematic text-[10px] uppercase tracking-widest hover:bg-[var(--theme-border)]/30 transition-all no-underline"
          >
            Enter Bills Manually →
          </Link>
        </div>
      </main>
    </div>
  );
}
