'use client';

import { useState } from 'react';
import { type Tier } from '@/src/lib/tiers';
import { Card, Badge, Button } from '@relentify/ui';

interface TierItem {
  tier: Tier;
  config: {
    label: string;
    introPrice: string;
    normalPrice: string;
    description: string;
    highlight?: boolean;
  };
  isCurrent: boolean;
  currentIndex: number;
  thisIndex: number;
}

interface Props {
  tiers: TierItem[];
  currentTier: Tier;
  subscriptionStatus: string;
}

export default function UpgradeCards({ tiers, currentTier, subscriptionStatus }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(tier: Tier) {
    setLoading(tier);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No URL returned:', data);
        setLoading(null);
      }
    } catch (e) {
      console.error('Checkout error:', e);
      setLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {tiers.map(({ tier, config, isCurrent, currentIndex, thisIndex }) => {
        const isHigher = thisIndex > currentIndex;
        const isLower = thisIndex < currentIndex;
        const isPaid = tier !== 'invoicing';
        const isHighlighted = config.highlight;

        return (
          <Card
            key={tier}
            variant="default"
            padding="md"
            className={`relative flex flex-col h-full border transition-all ${
              isCurrent ? 'ring-2 ring-[var(--theme-accent)]/30 border-[var(--theme-accent)]/50' : ''
            }`}
          >
            {/* Popular/Current badge */}
            {(isHighlighted && !isCurrent) && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="accent">Popular</Badge>
              </div>
            )}
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="accent">Current Plan</Badge>
              </div>
            )}

            <div className="flex-1">
              <h3 className="font-black text-[var(--theme-text)] text-base mb-1">{config.label}</h3>
              <p className="text-[var(--theme-text-muted)] text-xs mb-4 leading-relaxed">{config.description}</p>

              {isPaid ? (
                <div className="mb-4">
                  <div className="text-[var(--theme-accent)] font-black text-xl">{config.introPrice}</div>
                  <div className="text-[var(--theme-text-dim)] text-xs line-through">then {config.normalPrice}</div>
                  <div className="text-[10px] text-[var(--theme-text-dim)] mt-1">for 6 months</div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-[var(--theme-text)] font-black text-xl">Free</div>
                  <div className="text-[var(--theme-text-dim)] text-xs">forever</div>
                </div>
              )}
            </div>

            {/* Button */}
            {isCurrent ? (
              <Button
                disabled
                variant="outline"
                className="w-full rounded-cinematic text-[10px] uppercase tracking-widest font-black opacity-50"
              >
                Current Plan
              </Button>
            ) : isHigher ? (
              <Button
                onClick={() => handleUpgrade(tier)}
                disabled={loading === tier}
                variant="primary"
                className="w-full rounded-cinematic text-[10px] uppercase tracking-widest font-black"
              >
                {loading === tier ? 'Redirecting…' : 'Upgrade →'}
              </Button>
            ) : isLower && isPaid ? (
              <div className="w-full py-2.5 rounded-cinematic text-[10px] font-black uppercase tracking-widest text-center text-[var(--theme-text-dim)] border border-[var(--theme-border)] cursor-not-allowed">
                Contact us to downgrade
              </div>
            ) : isLower && !isPaid ? (
              <a
                href="mailto:hello@relentify.com?subject=Downgrade to Free"
                className="w-full py-2.5 rounded-cinematic text-[10px] font-black uppercase tracking-widest text-center text-[var(--theme-text-dim)] border border-[var(--theme-border)] hover:bg-[var(--theme-border)]/30 transition-all no-underline block"
              >
                Downgrade — support
              </a>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
