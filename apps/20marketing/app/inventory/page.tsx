'use client';
import React from 'react';
import { formatPrice, useRegion, useTheme } from '@relentify/ui';
import { cn } from '@relentify/ui';

import { motion } from 'motion/react';
import { Camera, FileCheck, Search, Share2, ArrowRight, CheckCircle2, Shield, Smartphone, Zap, Clock, PenTool, Download } from 'lucide-react';




export default function Inventory() {
  const { theme } = useTheme();
  const { region } = useRegion();

  const features = [
    {
      title: "Digital Reports",
      desc: "Check-in and check-out reports built for speed. Professional PDF output in seconds.",
      icon: <FileCheck />
    },
    {
      title: "Photo Evidence",
      desc: "Timestamped, high-resolution photo evidence for every room and item. Absolute clarity.",
      icon: <Camera />
    },
    {
      title: "Dispute Comparison",
      desc: "Side-by-side comparison of check-in vs check-out. Resolve disputes before they start.",
      icon: <Search />
    },
    {
      title: "Tenant Signatures",
      desc: "Capture digital signatures on-site. Legally binding and instantly synced to the cloud.",
      icon: <PenTool />
    },
    {
      title: "Offline Mode",
      desc: "No signal? No problem. Capture data and photos offline; they'll sync as soon as you're back.",
      icon: <Zap />
    },
    {
      title: "Instant Sharing",
      desc: "Share reports with tenants and landlords instantly via secure links. No more email attachments.",
      icon: <Share2 />
    }
  ];

  return (
    <div className="w-full pt-32">
      {/* Product Hero */}
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block"
            >
              Relentify Property Inventories
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}
            >
              Zero-Dispute <span className={theme.typography.drama}>Property Reports.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10"
            >
              Digital check-in/out reports with timestamped photo evidence. Built for letting agents who value precision, speed, and absolute clarity.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <button 
                className="magnetic-btn px-8 py-4 rounded-full font-bold text-white flex items-center gap-2 shadow-cinematic bg-[var(--theme-accent)]"
              >
                Reserve Free Trial <ArrowRight size={18} />
              </button>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="aspect-square rounded-cinematic bg-[var(--theme-border)] p-8">
              <div className="w-full h-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-8 flex flex-col gap-6">
                 <div className="flex items-center justify-between mb-4 border-b border-[var(--theme-border)] pb-4">
                    <div>
                       <h4 className="font-bold">Living Room</h4>
                       <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold">Check-in Report // 12 Mar 2026</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Clock size={12} className="opacity-40" />
                       <span className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40">14:20 GMT</span>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                       <div className="aspect-video bg-[var(--theme-border)] rounded-xl overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       </div>
                    </div>
                    <div className="relative group">
                       <div className="aspect-video bg-[var(--theme-border)] rounded-xl overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3 mt-4">
                    {[
                       { label: 'Walls & Ceilings', status: 'Excellent', color: 'emerald' },
                       { label: 'Flooring (Oak)', status: 'Good', color: 'blue' }
                    ].map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--theme-border)]">
                          <span className="text-xs font-bold">{item.label}</span>
                          <span className={cn(
                             "text-[var(--theme-text-10)] font-bold uppercase",
                             item.color === 'emerald' ? 'text-[var(--theme-success)]' : 'text-[var(--theme-accent)]'
                          )}>{item.status}</span>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Property Inventory Pricing.</h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Simple, pay-as-you-go or monthly plans for property professionals.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: 'Starter', price: 19, features: ['Up to 5 Reports /mo', 'Unlimited Photos', 'PDF Export', 'Email Support'] },
            { name: 'Professional', price: 49, features: ['Unlimited Reports', 'Side-by-side Comparison', 'Digital Signatures', 'Priority Support'], featured: true },
            { name: 'Agency', price: 99, features: ['Multi-user Access', 'Custom Branding', 'API Access', 'Dedicated Manager'] }
          ].map((tier, i) => (
            <div 
              key={i}
              className={cn(
                "rounded-cinematic p-10 border flex flex-col justify-between transition-all duration-500",
                tier.featured 
                  ? "bg-[var(--theme-dark)] text-white border-[var(--theme-dark)] shadow-cinematic scale-105 z-10" 
                  : "bg-[var(--theme-card)] border-[var(--theme-border)]"
              )}
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-8">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold">{formatPrice(tier.price, region)}</span>
                  <span className="opacity-40">/mo</span>
                </div>
                <ul className="flex flex-col gap-4 mb-12">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-bold">
                      <CheckCircle2 size={16} className={tier.featured ? "text-accent" : "text-[var(--theme-text)]/20"} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button 
                className={cn(
                  "w-full py-4 rounded-full font-bold transition-all",
                  tier.featured 
                    ? "bg-[var(--theme-accent)] text-white" 
                    : "bg-[var(--theme-border)] hover:bg-[var(--theme-dark)]/10"
                )}
              >
                Reserve Free Trial
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-accent mb-4">Capabilities</p>
            <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Precision in every pixel.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-[var(--theme-card)] p-10 rounded-cinematic border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all group">
                <div className="w-14 h-14 rounded-cinematic bg-[var(--theme-border)] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform text-accent">
                  {f.icon}
                </div>
                <h3 className={`text-2xl font-bold mb-4 ${theme.typography.headings}`}>{f.title}</h3>
                <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">{f.desc}</p>
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
              We're putting the finishing touches on the most precise property inventory tool ever built. Reserve your spot now to get 30 days free when we launch.
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
