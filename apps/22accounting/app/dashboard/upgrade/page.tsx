import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { TIER_CONFIG, TIER_ORDER, type Tier } from '@/src/lib/tiers';
import UpgradeCards from '@/src/components/UpgradeCards';
import FeaturesTable from '@/src/components/FeaturesTable';

export default async function UpgradePage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const user = await getUserById(auth.userId);
  const currentTier: Tier = (user?.tier as Tier) || 'invoicing';
  const subscriptionStatus: string = user?.subscription_status || 'trialing';

  // Build tier list (exclude accountant)
  const tiers = TIER_ORDER.map(tier => ({
    tier,
    config: TIER_CONFIG[tier],
    isCurrent: tier === currentTier,
    currentIndex: TIER_ORDER.indexOf(currentTier),
    thisIndex: TIER_ORDER.indexOf(tier),
  }));

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-2">Choose Your Plan</h2>
          <p className="text-[var(--theme-text-muted)] text-sm">
            Start with 6 months at intro pricing, then our normal rate. Cancel anytime.
          </p>
        </div>

        <UpgradeCards
          tiers={tiers}
          currentTier={currentTier}
          subscriptionStatus={subscriptionStatus}
        />

        {/* Features comparison table */}
        <div id="features" className="mt-16 scroll-mt-20">
          <div className="mb-6">
            <h3 className="text-xl font-black text-[var(--theme-text)] tracking-tight mb-1">What's included</h3>
            <p className="text-[var(--theme-text-muted)] text-sm">Full feature breakdown across all plans.</p>
          </div>
          <div className="bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)] rounded-cinematic sm:rounded-[2rem] px-4 sm:px-8 py-6 sm:py-8">
            <FeaturesTable currentTier={currentTier} />
          </div>
        </div>
      </main>
    </div>
  );
}
