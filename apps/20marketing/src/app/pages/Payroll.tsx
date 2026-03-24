import React from 'react';
import { formatPrice, useRegion, useTheme } from '../App';
import { cn } from '../lib/utils';

import { motion } from 'motion/react';
import { Users, CreditCard, FileText, Zap, CheckCircle2, ArrowRight, Shield, BarChart3, Clock } from 'lucide-react';

export default function Payroll() {
  const { theme } = useTheme();
  const { region } = useRegion();

  return (
    <div className="w-full pt-32">
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1">
             <div className="relative bg-[var(--theme-border)] rounded-cinematic p-12 overflow-hidden border border-[var(--theme-border)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-32 -mt-32" />

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  className="relative z-10 w-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-10"
                >
                   <div className="flex justify-between items-center border-b border-[var(--theme-border)] pb-6 mb-6">
                      <div>
                         <h4 className="font-bold text-lg">Monthly Payroll</h4>
                         <p className="text-[var(--theme-text-10)] text-[var(--theme-text-dim)] uppercase font-bold tracking-widest">Mar 2026 // 12 Employees</p>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl font-bold">{formatPrice(32450, region)}</p>
                         <span className="text-[var(--theme-text-10)] font-bold text-[var(--theme-success)] uppercase tracking-widest">Ready to Pay</span>
                      </div>
                   </div>
                   <div className="space-y-4 mb-8">
                      {[
                        { name: 'Alex Thompson', amount: 2450, status: 'Approved' },
                        { name: 'Sarah Miller', amount: 3120, status: 'Approved' },
                        { name: 'John Doe', amount: 1850, status: 'Pending' }
                      ].map((emp, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-cinematic bg-[var(--theme-border)]">
                           <span className="text-sm font-bold">{emp.name}</span>
                           <span className="text-sm font-bold">{formatPrice(emp.amount, region)}</span>
                        </div>
                      ))}
                   </div>
                   <button className="w-full py-5 rounded-cinematic bg-[var(--theme-dark)] text-white font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform">Submit to HMRC</button>
                </motion.div>

                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-8 relative z-10 w-full bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] p-8"
                >
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-cinematic bg-accent/10 flex items-center justify-center text-accent">
                         <Clock size={24} />
                      </div>
                      <h4 className="font-bold text-lg">Holiday Request</h4>
                   </div>
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-14 h-14 rounded-full bg-[var(--theme-border)] flex items-center justify-center font-bold text-xl">EW</div>
                      <div>
                         <p className="text-sm font-bold">Emily Watson</p>
                         <p className="text-xs text-[var(--theme-text-dim)]">3 Days // Annual Leave</p>
                      </div>
                   </div>
                   <div className="flex gap-4">
                      <button className="flex-1 py-3 rounded-xl bg-[var(--theme-success)] text-white text-xs font-bold uppercase tracking-widest">Approve</button>
                      <button className="flex-1 py-3 rounded-xl bg-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold uppercase tracking-widest">Decline</button>
                   </div>
                </motion.div>
             </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block">Relentify Payroll & HR</span>
            <h1 className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}>
              HR & Payroll <span className={theme.typography.drama}>Unified.</span>
            </h1>
            <p className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10">
              Fully integrated with Relentify Timesheets and Accounts. Automated HMRC submissions, holiday booking, and employee self-service in one place.
            </p>
            <div className="space-y-6 mb-12">
               {[
                 'Linked to Timesheets for automated pay runs',
                 'Direct sync with Relentify Accounting',
                 'Holiday booking & Sick day recording',
                 'Online payslips & P60 portal',
                 'Central hub for Company Policies'
               ].map((f, i) => (
                 <div key={i} className="flex items-center gap-4 font-bold text-lg">
                   <CheckCircle2 size={24} className="text-accent" />
                   {f}
                 </div>
               ))}
            </div>
            <button
              className="px-10 py-5 rounded-full font-bold text-white text-lg shadow-cinematic hover:scale-105 transition-transform bg-[var(--theme-accent)]"
            >
              Reserve Free Trial
            </button>
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { title: 'HMRC RTI Submissions', desc: 'Automated Real Time Information (RTI) submissions to HMRC. No more manual filing.', icon: <Shield /> },
                { title: 'Pension Auto-Enrolment', desc: 'Integrated pension management with all major UK providers. Stay compliant effortlessly.', icon: <Zap /> },
                { title: 'Employee Self-Service', desc: 'Employees can access payslips, P60s, and request leave from their own mobile portal.', icon: <Users /> }
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
              HR and Payroll, finally in one place. Reserve your spot now to get 30 days of free access for your entire company at launch.
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
