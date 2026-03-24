import React from 'react';
import { useTheme } from '../../App';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, Zap, Shield, Layers, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QuickBooksAlternative() {
  const { theme } = useTheme();

  const features = [
    { title: 'Transparent Pricing', desc: 'Simple, predictable costs that don\'t scale with your success.' },
    { title: 'Modern Interface', desc: 'Designed for efficiency, reducing the time you spend on admin.' },
    { title: 'Powerful Reporting', desc: 'Customisable reports that give you the data you need, when you need it.' },
    { title: 'Multi-Business Management', desc: 'Seamlessly switch between businesses without logging out.' },
    { title: 'Unlimited Users & Invoices', desc: 'Scale your operations without increasing your software bill.' },
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
            A Faster <span className={theme.typography.drama}>QuickBooks Alternative.</span>
          </h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto mb-12">
            QuickBooks is powerful, but it can often feel cluttered and legacy-heavy. Relentify provides a fresh start with a focus on speed, simplicity, and the features that actually move the needle for your business.
          </p>
          <div className="flex justify-center">
            <Link 
              to="/accounting"
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Experience the Relentify Difference
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
