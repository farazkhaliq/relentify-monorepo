'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';
import { motion } from 'motion/react';
import { ArrowRight, Layers, Zap, Shield, FileText } from 'lucide-react';
import Link from 'next/link';

export default function AlternativesHub() {
  const { theme } = useTheme();

  const links = [
    { name: 'Xero Alternative', path: '/xero-alternative', desc: 'Why modern businesses are moving away from Xero.' },
    { name: 'QuickBooks Alternative', path: '/quickbooks-alternative', desc: 'A faster, cleaner alternative to QuickBooks.' },
    { name: 'Xero vs Relentify', path: '/xero-v-relentify', desc: 'A side-by-side feature comparison.' },
    { name: 'QuickBooks vs Relentify', path: '/quickbooks-v-relentify', desc: 'See how we stack up against the giant.' },
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
            Relentify <span className={theme.typography.drama}>Alternatives.</span>
          </h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto mb-12">
            Legacy accounting software was built for a different era. Relentify is the modern alternative designed for the speed of today’s business. Explore how we compare to the market leaders.
          </p>
          <div className="flex justify-center">
            <Link
              href="/accounting"
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Start Your Free Trial
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {links.map((link, i) => (
            <Link
              key={i}
              href={link.path}
              className="p-12 bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all group flex flex-col justify-between"
            >
              <div>
                <h2 className={`text-3xl font-bold mb-4 ${theme.typography.headings}`}>{link.name}</h2>
                <p className="text-[var(--theme-text-muted)] mb-8">{link.desc}</p>
              </div>
              <div className="flex items-center gap-2 font-bold text-accent group-hover:gap-4 transition-all">
                Learn More <ArrowRight size={18} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
