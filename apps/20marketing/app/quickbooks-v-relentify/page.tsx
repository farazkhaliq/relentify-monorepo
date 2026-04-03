'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function QuickBooksVsRelentify() {
  const { theme } = useTheme();

  const comparison = [
    { feature: 'Transparent Pricing', qb: 'Variable/Hidden', relentify: 'Transparent & Fixed' },
    { feature: 'Modern Interface', qb: 'Legacy UI', relentify: 'Modern & Fast' },
    { feature: 'Reporting', qb: 'Standard', relentify: 'Advanced Analytics' },
    { feature: 'Multi-Business', qb: 'Limited', relentify: 'Native Multi-Entity' },
    { feature: 'Unlimited Users', qb: 'Tier-Limited', relentify: 'Unlimited' },
  ];

  return (
    <div className="w-full pt-32 px-6">
      <section className="max-w-7xl mx-auto mb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <h1 className={`text-6xl md:text-8xl font-bold mb-8 ${theme.typography.headings}`}>
            QuickBooks vs <span className={theme.typography.drama}>Relentify.</span>
          </h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto mb-12">
            QuickBooks has the history, but Relentify has the future. Compare the key features to see why more businesses are making the switch.
          </p>
          <div className="flex justify-center">
            <Link 
              to="/accounting"
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Switch Now
            </Link>
          </div>
        </motion.div>

        <div className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-cinematic overflow-hidden mb-20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--theme-dark)] text-white">
                <th className="p-8 text-sm font-bold uppercase tracking-widest">Feature</th>
                <th className="p-8 text-sm font-bold uppercase tracking-widest">QuickBooks</th>
                <th className="p-8 text-sm font-bold uppercase tracking-widest">Relentify</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-border)] transition-colors">
                  <td className="p-8 font-bold text-lg">{row.feature}</td>
                  <td className="p-8 text-[var(--theme-text-muted)] font-medium">{row.qb}</td>
                  <td className="p-8 font-bold text-accent">{row.relentify}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
