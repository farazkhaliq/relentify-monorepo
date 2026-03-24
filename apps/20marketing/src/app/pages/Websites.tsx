import React, { useRef } from 'react';
import { formatPrice, useRegion, useTheme } from '../App';
import { cn } from '../lib/utils';

import { motion } from 'motion/react';
import { Globe, Phone, Monitor, CheckCircle2, ArrowRight, Shield, Zap, Server, Layout, Cpu, MessageSquare } from 'lucide-react';

export default function Websites() {
  const { theme } = useTheme();
  const { region } = useRegion();

  const webSection = useRef<HTMLDivElement>(null);
  const gallerySection = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const services = [
    {
      title: 'Premium Website Design',
      desc: 'Professional, high-performance websites built to convert. We design for free, you just pay for hosting.',
      icon: <Globe />,
      ref: webSection
    },
    {
      title: 'Design Gallery',
      desc: 'Explore our portfolio of unbelievable designs across various industries.',
      icon: <Layout />,
      ref: gallerySection
    }
  ];

  const designs = [
    {
      name: 'Ascot Knight',
      category: 'Real Estate & Concierge',
      img: 'https://picsum.photos/seed/ascot/1200/800',
      url: 'https://ascotknight.co.uk',
      feature: 'Live Property Sync'
    },
    {
      name: 'Kingfisher Pharmacy',
      category: 'Healthcare',
      img: 'https://picsum.photos/seed/pharmacy/1200/800',
      url: 'https://kingfisherpharmacy.co.uk',
      feature: 'Smart Prescription Engine'
    },
    {
      name: 'SimpleCalc',
      category: 'Financial Tools',
      img: 'https://picsum.photos/seed/calc/1200/800',
      url: 'https://simplecalc.co',
      feature: 'Instant Tax Calculations'
    },
    {
      name: 'The Artisan Table',
      category: 'Fine Dining',
      img: 'https://picsum.photos/seed/dining/1200/800',
      url: '#',
      feature: 'Real-time Table Booking'
    },
    {
      name: 'Summit Law Group',
      category: 'Legal Services',
      img: 'https://picsum.photos/seed/law/1200/800',
      url: '#',
      feature: 'Secure Document Vault'
    },
    {
      name: 'Elevate Creative',
      category: 'Digital Agency',
      img: 'https://picsum.photos/seed/agency/1200/800',
      url: '#',
      feature: 'Interactive Project Pipeline'
    }
  ];

  return (
    <div className="w-full pt-32">
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="text-center mb-20">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block"
          >
            Relentify Websites
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`text-6xl md:text-9xl font-bold leading-[0.85] mb-8 ${theme.typography.headings}`}
          >
            Websites that <br /> <span className={theme.typography.drama}>Win Business.</span>
          </motion.h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto mb-12">
            Unbelievable designs, lightning-fast performance, and zero upfront cost. We build your dream site for free — you only pay for premium hosting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {services.map((s, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -10, scale: 1.02 }}
              className="p-16 bg-[var(--theme-card)] rounded-cinematic border border-[var(--theme-border)] shadow-cinematic hover:shadow-cinematic transition-all group cursor-pointer relative overflow-hidden"
              onClick={() => scrollTo(s.ref)}
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-bl-accent -mr-10 -mt-10 group-hover:scale-125 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="w-20 h-20 rounded-cinematic bg-accent/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform text-accent">
                  {React.cloneElement(s.icon as React.ReactElement, { size: 40 })}
                </div>
                <h3 className="text-4xl font-bold mb-6">{s.title}</h3>
                <p className="text-lg text-[var(--theme-text-muted)] leading-relaxed mb-10">{s.desc}</p>
                <div className="inline-flex items-center gap-3 font-bold text-accent group-hover:gap-5 transition-all">
                  Explore {s.title} <ArrowRight size={20} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Website Design Section */}
      <section ref={webSection} className="py-32 px-6 bg-[var(--theme-dark)] text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-accent/10 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div>
              <h2 className={`text-5xl md:text-7xl font-bold mb-8 leading-tight ${theme.typography.headings}`}>
                Premium Design. <br /> <span className="text-[var(--theme-accent)]">Zero Upfront Cost.</span>
              </h2>
              <p className="text-xl text-[var(--theme-text-muted)] mb-10 leading-relaxed">
                Most agencies charge thousands for a bespoke design. We don't. We'll provide a premium, custom-built business site for free — you only pay for our high-speed, managed hosting.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
                {[
                  'Bespoke premium design',
                  'Mobile-optimized',
                  'CRM Integration',
                  'Daily Backups',
                  'SSL Security',
                  'Unlimited Updates'
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 font-bold text-sm">
                    <CheckCircle2 size={18} className="text-accent" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="p-10 bg-[var(--theme-card)]/5 rounded-cinematic border border-[var(--theme-card)]/10 backdrop-blur-xl inline-block">
                <p className="text-xs font-bold opacity-40 uppercase mb-2 tracking-widest">Managed Hosting</p>
                <p className="text-5xl font-bold mb-2">{formatPrice(25, region)}<span className="text-sm opacity-40">/mo</span></p>
                <p className="text-xs font-bold text-[var(--theme-success)] uppercase tracking-widest">Design & Build: {formatPrice(0, region)}</p>
              </div>
            </div>
            <div className="relative">
               <div className="aspect-video bg-[var(--theme-card)]/5 rounded-cinematic p-10 border border-[var(--theme-card)]/10 backdrop-blur-sm">
                  <div className="w-full h-full bg-[var(--theme-dark)] rounded-cinematic shadow-cinematic overflow-hidden border border-[var(--theme-card)]/10 relative group">
                     <div className="h-8 bg-[var(--theme-dark)]/80 flex items-center px-4 gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--theme-destructive)]/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--theme-warning)]/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--theme-success)]/50" />
                     </div>
                     <div className="relative h-full">
                       <img
                          src="https://picsum.photos/seed/webdesign/1200/800"
                          alt="Premium Web Design"
                          className="w-full h-full object-cover opacity-80"
                          referrerPolicy="no-referrer"
                       />
                       <div className="absolute inset-0 bg-[var(--theme-dark)]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="px-6 py-3 bg-[var(--theme-card)] text-[var(--theme-text)] rounded-full font-bold text-sm">Preview Live Site</div>
                       </div>
                     </div>
                  </div>
               </div>
               {/* Floating Feature Tags */}
               <motion.div
                 animate={{ y: [0, -10, 0] }}
                 transition={{ duration: 4, repeat: Infinity }}
                 className="absolute -top-6 -right-6 px-6 py-3 bg-accent text-white rounded-cinematic font-bold text-xs shadow-cinematic z-20"
               >
                 SEO Optimized
               </motion.div>
               <motion.div
                 animate={{ y: [0, 10, 0] }}
                 transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                 className="absolute -bottom-6 -left-6 px-6 py-3 bg-[var(--theme-card)] text-[var(--theme-text)] rounded-cinematic font-bold text-xs shadow-cinematic z-20"
               >
                 CRM Linked
               </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Design Gallery Section */}
      <section ref={gallerySection} className="py-32 px-6 bg-[var(--theme-background)] text-[var(--theme-text)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={`text-5xl md:text-7xl font-bold mb-8 ${theme.typography.headings}`}>Unbelievable <span className="text-accent">Designs.</span></h2>
            <p className="text-xl text-[var(--theme-text-dim)] max-w-2xl mx-auto">
              We don't do templates. Every Relentify site is a bespoke masterpiece designed to make your competitors look like they're in the 90s.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {designs.map((d, i) => (
              <motion.a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group relative aspect-[4/5] overflow-hidden rounded-cinematic cursor-pointer shadow-cinematic hover:shadow-cinematic transition-all block"
              >
                <img
                  src={d.img}
                  alt={d.name}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-[var(--theme-dark)]/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />

                <div className="absolute inset-0 flex flex-col justify-end p-10">
                  <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <p className="text-xs font-bold text-accent uppercase tracking-widest mb-2">{d.category}</p>
                    <h4 className="text-3xl font-bold text-white mb-4">{d.name}</h4>
                    <div className="flex items-center gap-2 text-[var(--theme-text-10)] font-bold uppercase tracking-widest bg-[var(--theme-card)]/10 backdrop-blur-md px-3 py-1.5 rounded-full w-fit mb-4 text-[var(--theme-text)]">
                      <Zap size={10} className="text-accent" />
                      {d.feature}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      Visit Website <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </motion.a>
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
              Get a website that wins business. Reserve your spot now to get your first 30 days of managed hosting free when we launch.
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
