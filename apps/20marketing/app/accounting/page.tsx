'use client';
import React, { useState } from 'react';
import { useTheme, useRegion, formatPrice, Dialog, DialogContent, DialogHeader, DialogTitle } from '@relentify/ui';
import { cn } from '@relentify/ui';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, CreditCard, RefreshCw, FileText, Shield, Zap, Layers, Users, QrCode, Star } from 'lucide-react';
import { SignupForm } from '../components/SignupForm';

export default function Accounting() {
  const { theme } = useTheme();
  const { region } = useRegion();
  const [signupOpen, setSignupOpen] = useState(false);

  const tiers = [
    { 
      name: 'Sole Trader', 
      price: 4.99, 
      intro: 0.99, 
      xeroComp: 'No Xero Equivalent',
      features: [
        'Everything in Invoicing, plus:',
        'Accountant Portal Access',
        'Bank Sync (Real-time)',
        'Enter bills & capture receipts',
        'Project tracking (Included)',
        'Unlimited Users & Invoices'
      ], 
      featured: false 
    },
    { 
      name: 'Small Business', 
      price: 12.50, 
      intro: 1.99, 
      xeroComp: `${formatPrice(16, region)} (Standard)`,
      features: [
        'Everything in Sole Trader, plus:',
        'MTD Ready (Submit VAT)',
        'Track projects & profitability',
        'Unlimited Users & Invoices'
      ], 
      featured: false 
    },
    { 
      name: 'Medium Business', 
      price: 29, 
      intro: 4.99, 
      xeroComp: `${formatPrice(37, region)} (Premium)`,
      features: [
        'Everything in Small Business, plus:',
        'Multi-Business Management (2)',
        'Purchase order approvals',
        'Use multiple currencies',
        'Analyse KPIs & ratios',
        'Unlimited Users & Invoices'
      ], 
      featured: true 
    },
    { 
      name: 'Corporate', 
      price: 49, 
      intro: 8.99, 
      xeroComp: `${formatPrice(65, region)} (Ultimate)`,
      features: [
        'Everything in Medium Business, plus:',
        'Multi-Business Management (5)',
        'Intercompany transactions',
        'Consolidated reporting',
        'Unlimited Users & Invoices'
      ], 
      featured: false 
    },
    { 
      name: 'Enterprise', 
      price: 549, 
      intro: 149, 
      xeroComp: 'No Xero Equivalent',
      features: [
        'Everything in Corporate, plus:',
        'Unlimited Businesses',
        'Unlimited Users & Invoices',
        'Priority support',
        'Dedicated account manager'
      ], 
      featured: false 
    }
  ];

  return (
    <div className="w-full pt-32">
      {/* Hero */}
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold uppercase tracking-widest text-[var(--theme-accent)] mb-6 block"
            >
              Relentify Accounts
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn("text-6xl md:text-8xl font-bold leading-[0.9] mb-8 text-[var(--theme-text)]", theme.typography.headings)}
            >
              Modern accounting for <span className={theme.typography.drama}>{region} business.</span>
            </motion.h1>
            <p className="text-xl text-[var(--theme-text)]/60 max-w-xl mb-10">
              A streamlined, high-precision financial OS. No per-user fees. No invoice limits. Just pure, modern performance.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setSignupOpen(true)}
                className="magnetic-btn px-8 py-4 rounded-full font-bold text-white flex items-center gap-2 shadow-cinematic bg-[var(--theme-accent)]"
              >
                Start Free Trial <ArrowRight size={18} />
              </button>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="aspect-square rounded-cinematic bg-[var(--theme-border)] p-8">
              <div className="w-full h-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-8 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-[var(--theme-border)] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)]">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase">Invoice #2048</p>
                      <p className="text-sm font-bold">Vanguard Media</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatPrice(1500, region)}</p>
                    <span className="text-[var(--theme-text-10)] font-bold text-[var(--theme-accent)] uppercase">Awaiting Payment</span>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center items-center gap-4 py-8">
                   <div className="w-32 h-32 bg-[var(--theme-border)] rounded-cinematic flex items-center justify-center p-3">
                      <QrCode size={100} className="opacity-80" />
                   </div>
                   <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Scan to Pay Instantly</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--theme-border)]">
                    <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase mb-1">Bank Sync</p>
                    <p className="text-xs font-bold">Connected</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--theme-border)]">
                    <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase mb-1">VAT Status</p>
                    <p className="text-xs font-bold">MTD Ready</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Free Tier Section - Separated */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-5xl mx-auto bg-[var(--theme-card)] rounded-cinematic p-12 md:p-20 border border-[var(--theme-border)] shadow-cinematic flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--theme-accent)] mb-4 block">Entry Level</span>
            <h2 className={cn("text-5xl font-bold mb-6", theme.typography.headings)}>Invoicing is <span className={theme.typography.drama}>Free.</span></h2>
            <p className="text-lg text-[var(--theme-text-muted)] mb-8">
              Perfect for getting started. Send <span className="text-[var(--theme-text)] font-bold">unlimited</span> invoices and quotes. Get paid instantly with QR codes. No monthly fee, ever.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              {[
                'UNLIMITED Invoices & Quotes',
                'Create QR code for instant payment',
                'Accept online invoice payments',
                'Unlimited Users',
                'No monthly fee, ever'
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold">
                  <CheckCircle2 size={16} className="text-[var(--theme-accent)]" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setSignupOpen(true)}
              className="px-10 py-5 rounded-full font-bold text-white shadow-cinematic bg-[var(--theme-accent)] hover:scale-105 transition-transform"
            >
              Get Started for Free
            </button>
          </div>
          <div className="w-full md:w-72 aspect-square bg-[var(--theme-border)] rounded-cinematic flex items-center justify-center p-8">
             <div className="text-center">
                <p className="text-6xl font-bold mb-2">{formatPrice(0, region)}</p>
                <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Forever Free</p>
             </div>
          </div>
        </div>
      </section>

      {/* Paid Tiers - Cumulative & Readable */}
      <section className="py-32 px-6 max-w-screen-2xl mx-auto">
        <div className="text-center mb-20">
          <h2 className={cn("text-5xl md:text-7xl font-bold mb-6", theme.typography.headings)}>Fair Pricing.</h2>
          <p className="text-xl text-[var(--theme-text)]/60 max-w-2xl mx-auto">
            Transparent tiers that grow with you. No artificial limits on invoices or bills. All introductory prices are for the first 6 months.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {tiers.map((tier, i) => (
            <div 
              key={i}
              className={cn(
                "rounded-cinematic p-10 border flex flex-col transition-all duration-500",
                tier.featured 
                  ? "bg-[var(--theme-dark)] text-white border-[var(--theme-dark)] shadow-cinematic scale-105 z-10" 
                  : "bg-[var(--theme-card)] border-[var(--theme-border)]"
              )}
            >
              <div className="mb-10">
                <div className="flex justify-between items-start mb-8">
                   <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">{tier.name}</h3>
                   {tier.featured && <Star size={14} className="text-[var(--theme-accent)] fill-[var(--theme-accent)]" />}
                </div>
                
                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold tracking-tighter">{formatPrice(tier.intro, region)}</span>
                    <span className="text-sm opacity-40 font-bold">/mo</span>
                  </div>
                  <p className="text-xs opacity-40 mt-2 font-bold">Normal: {formatPrice(tier.price, region)}</p>
                </div>

                <div className={cn(
                  "p-4 rounded-cinematic mb-8 border",
                  tier.featured ? "bg-[var(--theme-card)]/5 border-[var(--theme-card)]/10" : "bg-[var(--theme-border)] border-[var(--theme-border)]"
                )}>
                   <p className="text-[var(--theme-text-10)] font-bold uppercase opacity-40 mb-1">Xero Equivalent</p>
                   <p className="text-lg font-bold">{tier.xeroComp}</p>
                </div>

                <ul className="flex flex-col gap-5">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-xs font-bold leading-snug">
                      <CheckCircle2 size={14} className={cn("mt-0.5 shrink-0", tier.featured ? "text-[var(--theme-accent)]" : "text-[var(--theme-text)]/20")} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto pt-10">
                <button 
                  className={cn(
                    "w-full py-4 rounded-full text-sm font-bold transition-all",
                    tier.featured 
                      ? "bg-[var(--theme-accent)] text-white" 
                      : "bg-[var(--theme-dark)] text-white hover:bg-[var(--theme-dark)]/80"
                  )}
                >
                  Buy Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={cn("text-5xl md:text-7xl font-bold mb-6", theme.typography.headings)}>Standard in <span className="text-[var(--theme-accent)]">Every Tier.</span></h2>
            <p className="text-xl text-[var(--theme-text)]/60 max-w-2xl mx-auto">
              We don't believe in charging extra for the basics. These features are included in every single Relentify plan.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Unlimited Users', desc: 'Add your whole team. We never charge per-user.', icon: <Users /> },
              { title: 'Unlimited Invoices', desc: 'Send as many as you need. No artificial caps.', icon: <FileText /> },
              { title: 'QR Payments', desc: 'Turn your phone into a card reader instantly.', icon: <QrCode /> },
              { title: 'Online Payments', desc: 'Accept cards and digital wallets on every invoice.', icon: <CreditCard /> },
              { title: 'MTD Ready', desc: 'Fully compliant with HMRC digital tax requirements.', icon: <Shield /> },
              { title: 'Bank Sync', desc: 'Real-time feeds from all major banks.', icon: <RefreshCw /> },
              { title: 'Accountants Portal', desc: 'Free access for your accountant to manage your books.', icon: <Layers /> },
              { title: 'Modern Interface', desc: 'Streamlined, fast, and beautiful to use.', icon: <Zap /> }
            ].map((f, i) => (
              <div key={i} className="p-8 bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)] group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h4 className="text-lg font-bold mb-2 text-[var(--theme-text)]">{f.title}</h4>
                <p className="text-sm text-[var(--theme-text)]/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Features Section */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-32">
              <div>
                 <h2 className={cn("text-5xl md:text-7xl font-bold mb-8 leading-[0.9]", theme.typography.headings)}>
                    Your phone is now <br /> <span className="text-[var(--theme-accent)]">a Card Reader.</span>
                 </h2>
                 <p className="text-xl text-[var(--theme-text)]/60 mb-10">
                    Take payments on the spot. No expensive hardware, no monthly terminal fees. Just open the Relentify app, show your QR code, and get paid instantly.
                 </p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                       { title: 'Instant QR', desc: 'Generate a unique payment QR for any invoice in seconds.' },
                       { title: 'Project Tracking', desc: 'Included in all paid tiers. Track time and costs per job.' },
                       { title: 'Multi-Business', desc: 'Manage multiple companies from a single login.' },
                       { title: 'Accountant Ready', desc: 'Invite your accountant to collaborate for free.' }
                    ].map((f, i) => (
                       <div key={i}>
                          <h4 className="font-bold mb-2 text-[var(--theme-text)]">{f.title}</h4>
                          <p className="text-xs text-[var(--theme-text)]/60 leading-relaxed">{f.desc}</p>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="bg-[var(--theme-card)] rounded-cinematic p-12 shadow-cinematic border border-[var(--theme-border)]">
                 <div className="space-y-8">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold opacity-40 uppercase">VAT Return Status</span>
                       <span className="px-3 py-1 rounded-full bg-[var(--theme-success)]/10 text-[var(--theme-success)] text-[var(--theme-text-10)] font-bold">MTD READY</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--theme-border)] rounded-full overflow-hidden">
                       <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: '85%' }}
                          className="h-full bg-[var(--theme-accent)]"
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                       <div>
                          <p className="text-2xl font-bold">{formatPrice(4250, region)}</p>
                          <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold">Tax Liability</p>
                       </div>
                       <div>
                          <p className="text-2xl font-bold">Apr 15</p>
                          <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold">Next Filing</p>
                       </div>
                    </div>
                    <button className="w-full py-4 rounded-cinematic bg-[var(--theme-dark)] text-white font-bold text-sm">Preview Return</button>
                 </div>
              </div>
           </div>
        </div>
      </section>

      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start your free trial</DialogTitle>
          </DialogHeader>
          <SignupForm product="accounting" redirectUrl="https://accounting.relentify.com/dashboard" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
