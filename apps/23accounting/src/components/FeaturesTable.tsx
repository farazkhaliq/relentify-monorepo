import { FEATURE_CATEGORIES } from '@/src/lib/feature-list';
import { canAccess, TIER_CONFIG, TIER_ORDER, type Tier } from '@/src/lib/tiers';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge } from '@relentify/ui';

const DISPLAY_TIERS = TIER_ORDER; // invoicing → corporate

function Check() {
  return <span className="text-[var(--theme-accent)] font-black text-base leading-none">✓</span>;
}
function Dash() {
  return <span className="text-[var(--theme-text-dim)] opacity-30 text-sm leading-none">—</span>;
}

export default function FeaturesTable({ currentTier }: { currentTier: Tier }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <Table className="min-w-[600px]">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="w-48 sm:w-56" />
            {DISPLAY_TIERS.map(tier => {
              const isCurrent = tier === currentTier;
              return (
                <TableHead
                  key={tier}
                  className={`text-center px-2 py-4 ${isCurrent ? 'text-[var(--theme-accent)]' : ''}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="uppercase tracking-widest text-[10px] font-black">
                      {TIER_CONFIG[tier].label}
                    </span>
                    {isCurrent && (
                      <Badge variant="accent" className="text-[8px] px-1.5 py-0">Your plan</Badge>
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {FEATURE_CATEGORIES.map(({ category, rows }) => (
            <React.Fragment key={category}>
              {/* Category divider */}
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={DISPLAY_TIERS.length + 1}
                  className="pt-8 pb-2 px-6"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-dim)]">
                    {category}
                  </span>
                </TableCell>
              </TableRow>

              {/* Feature rows */}
              {rows.map(({ label, feature, soon, addon }) => (
                <TableRow
                  key={label}
                  className="group"
                >
                  <TableCell className="py-3 px-6 text-sm text-[var(--theme-text-muted)] font-medium">
                    {label}
                  </TableCell>

                  {DISPLAY_TIERS.map(tier => {
                    const isCurrent = tier === currentTier;
                    const included = canAccess(tier, feature);

                    return (
                      <TableCell
                        key={tier}
                        className={`py-3 px-2 text-center transition-colors ${
                          isCurrent ? 'bg-[var(--theme-accent)]/[0.03]' : ''
                        }`}
                      >
                        {soon ? (
                          <Badge variant="default" className="text-[8px] opacity-50">Soon</Badge>
                        ) : included && addon ? (
                          <Badge variant="outline" className="text-[8px] text-[var(--theme-accent)] border-[var(--theme-accent)]/30">Add-on</Badge>
                        ) : included ? (
                          <Check />
                        ) : (
                          <Dash />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import React from 'react';
