'use client';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, useRegion, formatPrice } from '@relentify/ui';
import { cn } from '@relentify/ui';
import Link from 'next/link';
import { ArrowRight, Zap, Shield, Layers, FileText, Camera, Users, QrCode, Smartphone, TrendingUp, CreditCard, Clock, PenTool, Globe, MessageSquare, Mail } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// --- Components ---

const LiquidityMonitor = () => {
  const { region } = useRegion();
  
  return (
    <div className="w-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-8 flex flex-col gap-6 overflow-hidden relative">
      <div className="flex justify-between items-center border-b border-[var(--theme-border)] pb-6">
        <div>
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mb-1">Liquidity Monitor</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--theme-accent)] animate-pulse" />
            <span className="text-xs font-bold">Bank Feeds: Connected & Live</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mb-1">Cash Position</p>
          <p className="text-3xl font-bold tracking-tighter">{formatPrice(84200, region)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-cinematic bg-[var(--theme-border)]">
          <p className="text-[var(--theme-text-10)] font-bold uppercase opacity-40 mb-1">Total Invoiced</p>
          <p className="text-xl font-bold">{formatPrice(142500, region)}</p>
        </div>
        <div className="p-4 rounded-cinematic bg-[var(--theme-border)]">
          <p className="text-[var(--theme-text-10)] font-bold uppercase opacity-40 mb-1">Ready to Pay</p>
          <p className="text-xl font-bold">{formatPrice(12300, region)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40">Recent Approvals</p>
        {[
          { label: 'Vanguard Media', amount: 1500, status: 'Pending', color: 'amber' },
          { label: 'AWS Cloud', amount: 450, status: 'Approved', color: 'emerald' },
          { label: 'Starbucks', amount: 20, status: 'Rejected', color: 'red' }
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]/50">
            <div className="flex items-center gap-3">
              <div className={cn("w-2 h-2 rounded-full", 
                item.color === 'emerald' ? 'bg-[var(--theme-accent)]' : 
                item.color === 'red' ? 'bg-[var(--theme-destructive)]' : 'bg-[var(--theme-warning)]'
              )} />
              <span className="text-xs font-bold">{item.label}</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold">{formatPrice(item.amount, region)}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[var(--theme-accent)]/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
};

const Hero = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const { theme } = useTheme();
  const { region } = useRegion();
  const heroRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-text', {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.1,
        ease: 'power3.out',
      });
      gsap.from('.hero-graphic', {
        x: 60,
        opacity: 0,
        duration: 1.2,
        delay: 0.3,
        ease: 'power3.out',
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="relative min-h-[90dvh] w-full flex items-center pt-20 px-6 md:px-12 overflow-hidden">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] text-[var(--theme-text-10)] font-bold uppercase tracking-widest mb-6"
          >
            <Zap size={12} />
            <span>Solo. Team. Enterprise.</span>
          </motion.div>
          <h1 className="flex flex-col gap-1 mb-6">
            <span className={cn("hero-text text-5xl md:text-7xl font-bold tracking-tight", theme.typography.headings)}>
              Business software
            </span>
            <span className={cn("hero-text text-6xl md:text-8xl leading-tight text-[var(--theme-accent)]", theme.typography.drama)}>
              built for Growth.
            </span>
          </h1>
          <p className="hero-text text-lg md:text-xl text-[var(--theme-text)]/60 max-w-xl mb-10 text-balance">
            Accounting, property inventories, and CRM — all built for small businesses that move fast. One suite, no legacy clutter.
          </p>
          <div className="hero-text flex flex-wrap gap-4">
            <button 
              onClick={onGetStarted}
              className="magnetic-btn px-8 py-4 rounded-full text-lg font-bold text-white flex items-center gap-3 group shadow-cinematic bg-[var(--theme-accent)]"
            >
              Get Started Free
              <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onGetStarted}
              className="px-8 py-4 rounded-full text-lg font-bold border border-[var(--theme-text)]/10 hover:bg-[var(--theme-text)]/5 transition-all text-[var(--theme-text)]"
            >
              Book a Demo
            </button>
          </div>
        </div>

        <div className="hero-graphic relative">
          <LiquidityMonitor />
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -left-10 p-4 bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] flex items-center gap-3 z-20"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)]">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase">Instant Pay</p>
              <p className="text-xs font-bold">{formatPrice(1240, region)} Received</p>
            </div>
          </motion.div>
          
          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-6 -right-6 p-4 bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] flex items-center gap-3 z-20"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)]">
              <QrCode size={20} />
            </div>
            <div>
              <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase">QR Payment</p>
              <p className="text-xs font-bold">Scan to Pay Active</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const SuiteCard = ({ title, subtitle, features, icon, link, color }: { title: string, subtitle: string, features: string[], icon: React.ReactNode, link: string, color: string }) => {
  const { theme } = useTheme();
  return (
    <div className="group relative bg-[var(--theme-card)] rounded-cinematic p-10 border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all duration-700 overflow-hidden flex flex-col h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--theme-accent)]/5 rounded-bl-accent -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10">
        <div className="w-14 h-14 rounded-cinematic bg-[var(--theme-border)] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500" style={{ color: color }}>
          {icon}
        </div>
        <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mb-2">{subtitle}</p>
        <h3 className={cn("text-3xl font-bold mb-6", theme.typography.headings)}>{title}</h3>
        
        <ul className="space-y-4 mb-10">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-3 text-sm font-medium text-[var(--theme-text-muted)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--theme-dark)]/20 group-hover:bg-[var(--theme-accent)] transition-colors" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto relative z-10">
        <Link
          href={link}
          className="inline-flex items-center gap-2 font-bold text-sm group/btn"
        >
          Explore {title}
          <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
};

// --- Page ---

export default function Home() {
  const { theme } = useTheme();
  const { region } = useRegion();

  const contactRef = useRef<HTMLDivElement>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const scrollToContact = () => {
    contactRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const openChat = () => {
    if ((window as any).$chatwoot) {
      (window as any).$chatwoot.toggle();
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const slides = [
    {
      title: "Ready for better accounts?",
      desc: "Join thousands of businesses simplifying their finance. Get 6 months of Relentify Accounting at a deep discount when you join today.",
      btnText: "Buy Now"
    },
    {
      title: "Streamline your properties?",
      desc: "Professional reports, digital check-ins, and timestamped evidence. Reserve your free trial of Relentify Property Inventories today.",
      btnText: "Reserve Free Trial"
    },
    {
      title: "Close more deals?",
      desc: "Pipeline tracking, lead management, and automated follow-ups. Reserve your free trial of Relentify CRM.",
      btnText: "Reserve Free Trial"
    }
  ];

  return (
    <div className="w-full">
      <Hero onGetStarted={scrollToContact} />

      {/* QR Payment Highlight */}
      <section className="py-32 px-6 bg-[var(--theme-dark)] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
           <div className="w-full h-full bg-gradient-to-l from-[var(--theme-accent)]/50 to-transparent" />
        </div>
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--theme-card)]/10 text-white text-[var(--theme-text-10)] font-bold uppercase tracking-widest mb-6">
              <Smartphone size={12} />
              <span>Mobile First Payments</span>
            </div>
            <h2 className={cn("text-5xl md:text-7xl font-bold mb-8 leading-[0.9]", theme.typography.headings)}>
              Scan. Pay. <br /> <span className="text-[var(--theme-accent)]">Done.</span>
            </h2>
            <p className="text-xl text-[var(--theme-text-muted)] mb-10 max-w-xl">
              Plumbers, florists, or hairdressers — take payments instantly on your mobile. Relentify generates a unique QR code for your customer to scan and pay immediately. No card reader needed.
            </p>
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <p className="text-3xl font-bold mb-2">0%</p>
                  <p className="text-xs opacity-40 uppercase font-bold tracking-widest">Hardware Cost</p>
               </div>
               <div>
                  <p className="text-3xl font-bold mb-2">Instant</p>
                  <p className="text-xs opacity-40 uppercase font-bold tracking-widest">Reconciliation</p>
               </div>
            </div>
          </div>
          
          <div className="relative flex justify-center">
             <motion.div 
               initial={{ rotate: -10, y: 50 }}
               whileInView={{ rotate: 0, y: 0 }}
               className="w-64 aspect-[9/19] bg-[var(--theme-dark)] rounded-cinematic border-8 border-zinc-800 shadow-cinematic overflow-hidden relative"
             >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[var(--theme-dark)]/80 rounded-b-2xl z-20" />
                <div className="p-6 pt-12 flex flex-col items-center gap-8 h-full bg-[var(--theme-card)] text-[var(--theme-text)]">
                   <div className="text-center">
                      <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase">Payment Request</p>
                      <p className="text-2xl font-bold">{formatPrice(120, region)}</p>
                   </div>
                   <div className="w-40 h-40 bg-[var(--theme-border)] rounded-cinematic flex items-center justify-center p-4">
                      <QrCode size={120} className="text-[var(--theme-text)]" />
                   </div>
                   <p className="text-[var(--theme-text-10)] text-center opacity-40">Scan with your banking app to pay instantly via domestic rails.</p>
                   <div className="mt-auto w-full py-3 rounded-xl bg-[var(--theme-dark)] text-white text-center text-xs font-bold">
                      Relentify Pay
                   </div>
                </div>
             </motion.div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-[var(--theme-card)]/5 rounded-full pointer-events-none" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border border-[var(--theme-card)]/5 rounded-full pointer-events-none" />
          </div>
        </div>
      </section>

      {/* The Suite - Expanded */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="mb-20 text-center">
          <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mb-4">The Relentify Suite</p>
          <h2 className={cn("text-5xl md:text-7xl font-bold mb-6", theme.typography.headings)}>Everything your business needs.</h2>
          <p className="text-xl text-[var(--theme-text)]/60 max-w-2xl mx-auto">
            A unified engine for accounting, property, and operations. Built for the modern UK economy.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          <SuiteCard 
            title="Accounts" 
            subtitle="Smart Accounting"
            color="var(--theme-primary)"
            features={[
              'Invoicing & card payment links',
              'Bank feeds & reconciliation',
              'MTD-ready VAT',
              'P&L, cash flow & KPI reports'
            ]}
            icon={<FileText size={28} />}
            link="/accounting"
          />
          <SuiteCard 
            title="Property Inventories" 
            subtitle="Check-ins & Reports"
            color="var(--theme-accent)"
            features={[
              'Digital check-in/out reports',
              'Timestamped photo evidence',
              'Side-by-side dispute comparison',
              'Professional PDF output'
            ]}
            icon={<Camera size={28} />}
            link="/inventory"
          />
          <SuiteCard 
            title="CRM" 
            subtitle="Customer Relationships"
            color="var(--theme-warning)"
            features={[
              'Lead & contact management',
              'Follow-up scheduling',
              'Pipeline & deal tracking',
              'Activity timeline'
            ]}
            icon={<Users size={28} />}
            link="/crm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: 'Timesheets', icon: <Clock />, link: '/timesheets', color: 'var(--theme-accent)' },
            { title: 'E-Sign', icon: <PenTool />, link: '/esign', color: 'var(--theme-accent)' },
            { title: 'Payroll & HR', icon: <CreditCard />, link: '/payroll', color: 'var(--theme-accent)' },
            { title: 'Websites', icon: <Globe />, link: '/websites', color: 'var(--theme-accent)' }
          ].map((s, i) => (
            <Link
              key={i}
              href={s.link}
              className="p-8 bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-sm hover:shadow-cinematic transition-all group flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--theme-border)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform" style={{ color: s.color }}>
                {s.icon}
              </div>
              <h4 className="font-bold mb-2 text-[var(--theme-text)]">{s.title}</h4>
              <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase tracking-widest">Explore Product</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Modern Advantage - Enlarged Boxes */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="p-16 bg-[var(--theme-card)] rounded-cinematic shadow-sm border border-[var(--theme-border)] flex flex-col gap-8"
                >
                   <div className="w-20 h-20 rounded-cinematic bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)]">
                      <Zap size={40} />
                   </div>
                   <div>
                      <h4 className="text-3xl font-bold mb-4">Fresh & Modern</h4>
                      <p className="text-base text-[var(--theme-text-muted)] leading-relaxed">Built on 2026 tech, not legacy systems from 20 years ago. Experience speed like never before.</p>
                   </div>
                </motion.div>
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="p-16 bg-[var(--theme-card)] rounded-cinematic shadow-sm border border-[var(--theme-border)] mt-16 flex flex-col gap-8"
                >
                   <div className="w-20 h-20 rounded-cinematic bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)]">
                      <Shield size={40} />
                   </div>
                   <div>
                      <h4 className="text-3xl font-bold mb-4">Secure by Design</h4>
                      <p className="text-base text-[var(--theme-text-muted)] leading-relaxed">Bank-grade encryption and multi-factor security as standard. Your data is your most valuable asset.</p>
                   </div>
                </motion.div>
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="p-16 bg-[var(--theme-card)] rounded-cinematic shadow-sm border border-[var(--theme-border)] flex flex-col gap-8"
                >
                   <div className="w-20 h-20 rounded-cinematic bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)]">
                      <TrendingUp size={40} />
                   </div>
                   <div>
                      <h4 className="text-3xl font-bold mb-4">Better Value</h4>
                      <p className="text-base text-[var(--theme-text-muted)] leading-relaxed">Premium features without the legacy enterprise price tag. We undercut the market leaders on price, not quality.</p>
                   </div>
                </motion.div>
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="p-16 bg-[var(--theme-card)] rounded-cinematic shadow-sm border border-[var(--theme-border)] mt-16 flex flex-col gap-8"
                >
                   <div className="w-20 h-20 rounded-cinematic bg-[var(--theme-warning)]/10 flex items-center justify-center text-[var(--theme-warning)]">
                      <Layers size={40} />
                   </div>
                   <div>
                      <h4 className="text-3xl font-bold mb-4">Unified Data</h4>
                      <p className="text-base text-[var(--theme-text-muted)] leading-relaxed">One source of truth across your entire business operation. No more manual data entry between apps.</p>
                   </div>
                </motion.div>
             </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className={cn("text-5xl md:text-7xl font-bold mb-8 leading-[0.9]", theme.typography.headings)}>
              The Modern <br /> Advantage.
            </h2>
            <p className="text-xl text-[var(--theme-text)]/60 mb-10">
              We're competing with the giants, but our advantage is speed and usability. Relentify is built for the way you work today — mobile, integrated, and fast.
            </p>
            <button 
              className="px-8 py-4 rounded-full font-bold text-white shadow-cinematic bg-[var(--theme-accent)]"
            >
              See the Difference
            </button>
          </div>
        </div>
      </section>

      {/* Contact & Live Chat Section */}
      <section ref={contactRef} className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className={cn("text-5xl md:text-7xl font-bold mb-8 leading-[0.9]", theme.typography.headings)}>
                Need help? <br /> <span className="text-[var(--theme-accent)]">We're here.</span>
              </h2>
              <p className="text-xl text-[var(--theme-text)]/60 mb-12 max-w-xl">
                Our UK-based support team is ready to help you scale. Start a live chat for an instant response or send us a message below.
              </p>
              
              <div className="space-y-6">
                <div 
                  onClick={openChat}
                  className="flex items-center gap-6 p-8 rounded-cinematic bg-[var(--theme-card)] border border-[var(--theme-border)] hover:shadow-cinematic transition-all cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-cinematic bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)] group-hover:scale-110 transition-transform">
                    <MessageSquare size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">Live Chat</h4>
                    <p className="text-sm text-[var(--theme-text-dim)]">Instant response during business hours</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 p-8 rounded-cinematic bg-[var(--theme-card)] border border-[var(--theme-border)] hover:shadow-cinematic transition-all cursor-pointer group">
                  <div className="w-14 h-14 rounded-cinematic bg-[var(--theme-accent)]/10 flex items-center justify-center text-[var(--theme-accent)] group-hover:scale-110 transition-transform">
                    <Mail size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">Email Support</h4>
                    <p className="text-sm text-[var(--theme-text-dim)]">support@relentify.com</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-[var(--theme-card)] rounded-cinematic p-12 text-[var(--theme-text)] shadow-cinematic border border-[var(--theme-border)]">
              <h3 className="text-3xl font-bold mb-8">Send a Message</h3>
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[var(--theme-text-10)] font-bold uppercase opacity-40">Full Name</label>
                    <input type="text" className="w-full p-4 rounded-xl bg-[var(--theme-border)] border border-transparent focus:border-[var(--theme-accent)] outline-none transition-all" placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[var(--theme-text-10)] font-bold uppercase opacity-40">Email Address</label>
                    <input type="email" className="w-full p-4 rounded-xl bg-[var(--theme-border)] border border-transparent focus:border-[var(--theme-accent)] outline-none transition-all" placeholder="john@company.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[var(--theme-text-10)] font-bold uppercase opacity-40">Message</label>
                  <textarea className="w-full p-4 rounded-xl bg-[var(--theme-border)] border border-transparent focus:border-[var(--theme-accent)] outline-none transition-all h-32 resize-none" placeholder="How can we help?" />
                </div>
                <button 
                  type="button"
                  className="w-full py-5 rounded-full font-bold text-white shadow-cinematic hover:scale-[1.02] transition-all bg-[var(--theme-accent)]"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Carousel */}
      <section className="py-32 px-6 max-w-7xl mx-auto text-center">
        <div className="bg-[var(--theme-dark)] rounded-cinematic p-10 md:p-20 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--theme-accent)]/20 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlideIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className={cn("text-4xl md:text-7xl font-bold mb-8", theme.typography.headings)}>
                  {slides[activeSlideIndex].title}
                </h2>
                <p className="text-lg md:text-xl text-[var(--theme-text-muted)] mb-12 max-w-2xl mx-auto">
                  {slides[activeSlideIndex].desc}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button 
                    onClick={scrollToContact}
                    className="px-10 py-5 rounded-full font-bold text-lg shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
                  >
                    {slides[activeSlideIndex].btnText}
                  </button>
                  <button 
                    onClick={scrollToContact}
                    className="px-10 py-5 rounded-full font-bold text-lg border border-[var(--theme-card)]/20 hover:bg-[var(--theme-card)]/10 transition-all"
                  >
                    Book a Demo
                  </button>
                </div>

                {/* Carousel Indicators */}
                <div className="flex justify-center gap-2 mt-12">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSlideIndex(i)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        activeSlideIndex === i ? "w-8 bg-[var(--theme-accent)]" : "bg-[var(--theme-card)]/20 hover:bg-[var(--theme-card)]/40"
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );
}
