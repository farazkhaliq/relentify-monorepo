import React from 'react';
import { formatPrice, useRegion, useTheme } from '../App';
import { cn } from '../lib/utils';

import { motion } from 'motion/react';
import { PenTool, ShieldCheck, FileText, Zap, CheckCircle2, ArrowRight, Lock, Users } from 'lucide-react';

export default function ESign() {
  const { theme } = useTheme();
  const { region } = useRegion();

  return (
    <div className="w-full pt-32">
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block">Relentify E-Sign</span>
            <h1 className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}>
              Signatures <span className={theme.typography.drama}>Simplified.</span>
            </h1>
            <p className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10">
              The better-value alternative to DocuSign. Legally binding, secure, and integrated directly into your Relentify suite.
            </p>
            <div className="space-y-6 mb-12">
               {[
                 'Close deals faster with mobile-friendly signing',
                 'Reduce costs by up to 70% compared to DocuSign and paper-based processes',
                 'Bank-grade security and audit trails',
                 'Fully compliant with UK & EU e-signature laws'
               ].map((f, i) => (
                 <div key={i} className="flex items-center gap-3 font-bold text-sm">
                   <CheckCircle2 size={18} className="text-accent" />
                   {f}
                 </div>
               ))}
            </div>
            <button 
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic bg-[var(--theme-accent)]"
            >
              Reserve Free Trial
            </button>
          </div>
          
          <div className="relative">
             <div className="w-full aspect-square bg-[var(--theme-border)] rounded-cinematic p-8 flex items-center justify-center">
                <motion.div 
                  initial={{ rotate: -5, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  className="w-full max-w-md bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-10"
                >
                   <div className="border-b border-[var(--theme-border)] pb-6 mb-6">
                      <h4 className="font-bold">Agreement Signed</h4>
                      <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold text-[var(--theme-success)]">Verified by Relentify Trust™</p>
                   </div>
                   <div className="space-y-4 mb-10">
                      <div className="h-4 w-full bg-[var(--theme-border)] rounded-full" />
                      <div className="h-4 w-3/4 bg-[var(--theme-border)] rounded-full" />
                      <div className="h-4 w-5/6 bg-[var(--theme-border)] rounded-full" />
                   </div>
                   <div className="p-6 border-2 border-[var(--theme-success)]/20 rounded-cinematic bg-[var(--theme-success)]/10 flex flex-col items-center gap-4">
                      <ShieldCheck size={32} className="text-[var(--theme-success)]" />
                      <p className="text-xs font-bold text-[var(--theme-success)] uppercase tracking-widest">Legally Binding Signature</p>
                   </div>
                </motion.div>
             </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={`text-5xl font-bold mb-6 ${theme.typography.headings}`}>Honest E-Sign Pricing.</h2>
            <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
              Stop paying "DocuSign Tax". Simple, transparent tiers for every business size.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                name: 'Personal', 
                price: 5, 
                docusign: 8, 
                envelopes: '5 Envelopes /mo',
                features: ['Single User', 'Basic Fields', 'Mobile App Access', 'Real-time Audit Trail']
              },
              { 
                name: 'Standard', 
                price: 12, 
                docusign: 20, 
                envelopes: 'Unlimited Envelopes',
                features: ['Up to 3 Users', 'Custom Branding', 'Reminders & Notifications', 'Team Reporting'],
                featured: true
              },
              { 
                name: 'Business Pro', 
                price: 22, 
                docusign: 35, 
                envelopes: 'Unlimited Envelopes',
                features: ['Unlimited Users', 'Advanced Fields', 'Bulk Send', 'Signer Attachments', 'CRM Integration']
              }
            ].map((tier, i) => (
              <div key={i} className={`p-10 rounded-cinematic border flex flex-col ${tier.featured ? 'bg-[var(--theme-dark)] text-white border-[var(--theme-dark)] shadow-cinematic scale-105 z-10' : 'bg-[var(--theme-card)] border-[var(--theme-border)]'}`}>
                <div className="mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">{tier.name}</h3>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-bold">{formatPrice(tier.price, region)}</span>
                    <span className="text-sm opacity-40 font-bold">/mo</span>
                  </div>
                  <p className="text-sm font-bold text-accent">{tier.envelopes}</p>
                </div>

                <div className={`p-4 rounded-cinematic mb-8 border ${tier.featured ? 'bg-[var(--theme-card)]/5 border-[var(--theme-card)]/10' : 'bg-[var(--theme-border)] border-[var(--theme-border)]'}`}>
                   <p className="text-[var(--theme-text-10)] font-bold uppercase opacity-40 mb-1">DocuSign Equivalent</p>
                   <p className="text-lg font-bold">{formatPrice(tier.docusign, region)}</p>
                </div>

                <ul className="space-y-4 mb-10">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-xs font-bold">
                      <CheckCircle2 size={14} className={tier.featured ? 'text-accent' : 'text-[var(--theme-text)]/20'} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button className={`mt-auto w-full py-4 rounded-full font-bold text-sm ${tier.featured ? 'bg-accent text-white' : 'bg-[var(--theme-dark)] text-white'}`}>
                  Reserve Free Trial
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-[var(--theme-dark)] text-white">
        <div className="max-w-7xl mx-auto text-center">
           <h2 className="text-4xl md:text-6xl font-bold mb-20">Why switch to Relentify E-Sign?</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { title: 'Better Value', desc: 'Stop paying per-envelope. Our flat-rate pricing saves you up to 70% compared to DocuSign.', icon: <Zap /> },
                { title: 'Legally Binding', desc: 'Fully compliant with eIDAS and the UK Electronic Communications Act.', icon: <ShieldCheck /> },
                { title: 'Native Integration', desc: 'Send contracts directly from your CRM or Accounting dashboard with one click.', icon: <Zap /> }
              ].map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-6">
                   <div className="w-16 h-16 rounded-cinematic bg-[var(--theme-card)]/10 flex items-center justify-center text-accent">
                      {f.icon}
                   </div>
                   <h3 className="text-2xl font-bold">{f.title}</h3>
                   <p className="text-[var(--theme-text-dim)] leading-relaxed">{f.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* Reserve Trial CTA */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-[var(--theme-dark)] rounded-cinematic p-12 md:p-20 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[var(--theme-background-blur)]" />
          <div className="relative z-10">
            <h2 className={`text-4xl md:text-6xl font-bold mb-6 ${theme.typography.headings}`}>Reserve your free trial.</h2>
            <p className="text-xl text-[var(--theme-text-muted)] mb-12 max-w-xl mx-auto">
              Stop paying the DocuSign tax. Reserve your spot for Relentify E-Sign and get 30 days of unlimited signatures free when we launch.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center max-w-md mx-auto">
              <button 
                className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
              >
                Reserve My Spot
              </button>
            </div>
            <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mt-8">No credit card required • Early access priority</p>
          </div>
        </div>
      </section>
    </div>
  );
}
