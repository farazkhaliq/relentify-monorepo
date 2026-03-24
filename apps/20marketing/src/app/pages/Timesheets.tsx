import React from 'react';
import { formatPrice, useRegion, useTheme } from '../App';
import { cn } from '../lib/utils';

import { motion } from 'motion/react';
import { Clock, MapPin, Smartphone, Shield, CheckCircle2, ArrowRight, Zap, Users, BarChart3, Globe } from 'lucide-react';

export default function Timesheets() {
  const { theme } = useTheme();
  const { region } = useRegion();

  return (
    <div className="w-full pt-32">
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block">Relentify Timesheets</span>
            <h1 className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}>
              Clock in from <span className={theme.typography.drama}>anywhere.</span>
            </h1>
            <p className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10">
              Mobile-first timesheets for your field staff. GPS-stamped submissions, IP tracking, and instant admin approval.
            </p>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <button
                  className="px-8 py-4 rounded-full font-bold text-white shadow-cinematic bg-[var(--theme-accent)]"
                >
                  Reserve Free Trial
                </button>
                <div className="text-left">
                  <p className="text-2xl font-bold">{formatPrice(1, region)}<span className="text-sm opacity-40">/person/mo</span></p>
                  <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase tracking-widest">After Trial</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative">
             <div className="w-full aspect-square bg-[var(--theme-border)] rounded-cinematic p-8 flex items-center justify-center">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-64 aspect-[9/19] bg-[var(--theme-card)] rounded-cinematic border-8 border-[var(--theme-dark)] shadow-cinematic overflow-hidden relative"
                >
                   <div className="p-6 pt-12 flex flex-col gap-6 h-full">
                      <div className="text-center">
                         <p className="text-[var(--theme-text-10)] font-bold opacity-40 uppercase">Shift in Progress</p>
                         <p className="text-2xl font-bold">04:20:15</p>
                      </div>
                      
                      <div className="p-4 rounded-cinematic bg-[var(--theme-success)]/10 border border-[var(--theme-success)]/20 flex items-center gap-3">
                         <MapPin size={16} className="text-[var(--theme-success)]" />
                         <div>
                            <p className="text-[var(--theme-text-10)] font-bold text-[var(--theme-success)] uppercase">Verified Location</p>
                            <p className="text-[var(--theme-text-10)] font-medium">SE1 7PB, London</p>
                         </div>
                      </div>

                      <div className="mt-auto space-y-3">
                         <button className="w-full py-4 rounded-cinematic bg-[var(--theme-destructive)] text-white font-bold text-xs">Clock Out</button>
                         <button className="w-full py-4 rounded-cinematic bg-[var(--theme-border)] text-[var(--theme-text)] font-bold text-xs">Take Break</button>
                      </div>
                   </div>
                </motion.div>
             </div>
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { title: 'GPS Verification', desc: 'Every submission is stamped with precise GPS coordinates, ensuring your team is where they say they are.', icon: <MapPin /> },
              { title: 'IP Tracking', desc: 'Security first. We log the IP address and device info for every clock-in to prevent proxy abuse.', icon: <Shield /> },
              { title: 'Admin Control', desc: 'Easily configure shifts, overtime rules, and approval workflows from a central dashboard.', icon: <Zap /> }
            ].map((f, i) => (
              <div key={i} className="flex flex-col gap-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-bold">{f.title}</h3>
                <p className="text-[var(--theme-text-muted)] leading-relaxed">{f.desc}</p>
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
              Mobile-first timesheets that actually work. Reserve your spot now to get 30 days of free access for your entire team at launch.
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
