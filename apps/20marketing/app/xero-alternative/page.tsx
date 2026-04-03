'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, Zap, Shield, Layers, FileText } from 'lucide-react';
import Link from 'next/link';

export default function XeroAlternative() {
  const { theme } = useTheme();

  const features = [
    { title: 'Transparent Pricing', desc: 'No hidden fees or complex tier structures. One simple, fixed price.' },
    { title: 'Modern Interface', desc: 'A clean, fast, and intuitive experience built on 2026 technology.' },
    { title: 'Powerful Reporting', desc: 'Real-time insights into your cash flow and profitability.' },
    { title: 'Multi-Business Management', desc: 'Manage multiple entities from a single, unified dashboard.' },
    { title: 'Unlimited Users & Invoices', desc: 'We don\'t believe in charging you more just because your team is growing.' },
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
            The Best <span className={theme.typography.drama}>Xero Alternative.</span>
          </h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto mb-12">
            Xero has long been a staple, but for many businesses, the complexity and rising costs are becoming a burden. Relentify offers a streamlined, high-performance alternative that puts clarity and value first.
          </p>
          <div className="flex justify-center">
            <Link
              href="/accounting"
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Switch to Relentify Now
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((f, i) => (
            <div key={i} className="p-12 bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6 text-accent">
                <CheckCircle2 size={24} />
              </div>
              <h3 className={`text-2xl font-bold mb-4 ${theme.typography.headings}`}>{f.title}</h3>
              <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
