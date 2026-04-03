'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function XeroVsRelentify() {
  const { theme } = useTheme();

  const comparison = [
    { feature: 'Transparent Pricing', xero: 'Complex Tiers', relentify: 'Simple & Fixed' },
    { feature: 'Modern Interface', xero: 'Legacy/Cluttered', relentify: 'Streamlined/Fast' },
    { feature: 'Reporting', xero: 'Standard', relentify: 'High-Precision' },
    { feature: 'Multi-Business', xero: 'Extra Cost/Login', relentify: 'Native Support' },
    { feature: 'Unlimited Users', xero: 'Per-Seat Fees', relentify: 'Included' },
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
            Xero vs <span className={theme.typography.drama}>Relentify.</span>
          </h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto mb-12">
            Choosing between Xero and Relentify comes down to whether you want a legacy ecosystem or a modern, streamlined engine. Here is how we stack up.
          </p>
          <div className="flex justify-center">
            <Link 
              to="/accounting"
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Start Your Free Trial
            </Link>
          </div>
        </motion.div>

        <div className="bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-cinematic overflow-hidden mb-20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--theme-dark)] text-white">
                <th className="p-8 text-sm font-bold uppercase tracking-widest">Feature</th>
                <th className="p-8 text-sm font-bold uppercase tracking-widest">Xero</th>
                <th className="p-8 text-sm font-bold uppercase tracking-widest">Relentify</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-border)] transition-colors">
                  <td className="p-8 font-bold text-lg">{row.feature}</td>
                  <td className="p-8 text-[var(--theme-text-muted)] font-medium">{row.xero}</td>
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
