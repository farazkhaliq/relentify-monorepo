import React from 'react';
import { formatPrice, useRegion, useTheme } from '../App';
import { cn } from '../lib/utils';

import { motion } from 'motion/react';
import { Users, Calendar, TrendingUp, MessageSquare, ArrowRight, CheckCircle2, Zap, Mail, Phone, MapPin } from 'lucide-react';




export default function CRM() {
  const { theme } = useTheme();
  const { region } = useRegion();

  const features = [
    {
      title: "Applicant Matching",
      desc: "Automatically match new applicants to properties based on their requirements. Send instant alerts via SMS and Email.",
      icon: <Users />
    },
    {
      title: "Portal Feed Control",
      desc: "Real-time sync with Rightmove, Zoopla, and OnTheMarket. Manage your listings and leads from one central dashboard.",
      icon: <Zap />
    },
    {
      title: "Automated Viewings",
      desc: "Let applicants book viewings 24/7. Syncs with your team's calendars and sends automated reminders to reduce no-shows.",
      icon: <Calendar />
    },
    {
      title: "Property Management",
      desc: "Track maintenance issues, gas safety certificates, and EICRs. Automated alerts for upcoming renewals.",
      icon: <MapPin />
    },
    {
      title: "Pipeline Visualization",
      desc: "Drag-and-drop deal tracking. See exactly where every tenancy stands, from offer to move-in.",
      icon: <TrendingUp />
    },
    {
      title: "Marketing Automation",
      desc: "Nurture leads with automated sequences. Keep your brand top-of-mind without lifting a finger.",
      icon: <Mail />
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
              Relentify CRM
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}
            >
              The CRM for <span className={theme.typography.drama}>Modern Agencies.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10"
            >
              Built for letting agents who move fast. Outperform Expert Agent, Alto, and Jupix with a suite that's faster, smarter, and fully integrated.
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
                       <h4 className="font-bold">Lead Profile</h4>
                       <p className="text-[var(--theme-text-10)] opacity-40 uppercase font-bold">Sarah Jones // Rightmove Inquiry</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-accent/10 text-accent">Viewing Scheduled</span>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--theme-border)] flex items-center justify-center font-bold text-xl">SJ</div>
                    <div>
                       <p className="text-lg font-bold">Sarah Jones</p>
                       <div className="flex gap-4 mt-1">
                          <div className="flex items-center gap-1 opacity-40"><Phone size={12} /><span className="text-[var(--theme-text-10)]">07700 900123</span></div>
                          <div className="flex items-center gap-1 opacity-40"><Mail size={12} /><span className="text-[var(--theme-text-10)]">sarah@example.com</span></div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 mt-4">
                    <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40">Activity Timeline</p>
                    {[
                       { action: 'Inquiry Received', time: '2h ago', icon: <Mail size={12} /> },
                       { action: 'Viewing Scheduled', time: '1h ago', icon: <Calendar size={12} /> }
                    ].map((item, i) => (
                       <div key={i} className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-[var(--theme-border)] flex items-center justify-center text-accent">{item.icon}</div>
                          <div className="flex-1 border-b border-[var(--theme-border)] pb-2">
                             <p className="text-xs font-bold">{item.action}</p>
                             <p className="text-[var(--theme-text-10)] opacity-40">{item.time}</p>
                          </div>
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
          <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>CRM Pricing.</h2>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Scale your agency with a CRM built for speed and relationships.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: 'Basic', price: 29, features: ['Up to 100 Contacts', 'Lead Management', 'Email Integration', 'Basic Reporting'] },
            { name: 'Growth', price: 79, features: ['Unlimited Contacts', 'Portal Integration', 'Automated Follow-ups', 'Pipeline Tracking'], featured: true },
            { name: 'Enterprise', price: 199, features: ['Custom Workflows', 'Advanced Analytics', 'API Access', 'Dedicated Support'] }
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
            <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>Stop losing leads.</h2>
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
              The CRM for modern agencies is almost here. Reserve your spot now to get 30 days of premium access free at launch.
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
