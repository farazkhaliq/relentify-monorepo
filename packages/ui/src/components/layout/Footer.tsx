"use client";

import React from 'react';

export function Footer() {
  return (
    <footer 
      className="mt-20 pt-20 pb-10 px-6 rounded-t-[4rem] bg-[var(--theme-dark)] text-white"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <h2 className="text-3xl font-bold tracking-tighter mb-4 font-sans">
            RELENTIFY
          </h2>
          <p className="text-white/60 max-w-sm mb-8">
            The integrated business suite built for small companies that move fast.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-40">Product</h4>
          <ul className="flex flex-col gap-4">
            <li><a href="/accounting" className="hover:text-[var(--theme-accent)] transition-colors">Accounting</a></li>
            <li><a href="/inventory" className="hover:text-[var(--theme-accent)] transition-colors">Property Inventories</a></li>
            <li><a href="/crm" className="hover:text-[var(--theme-accent)] transition-colors">CRM</a></li>
            <li><a href="/timesheets" className="hover:text-[var(--theme-accent)] transition-colors">Timesheets</a></li>
            <li><a href="/esign" className="hover:text-[var(--theme-accent)] transition-colors">E-Sign</a></li>
            <li><a href="/payroll" className="hover:text-[var(--theme-accent)] transition-colors">Payroll & HR</a></li>
            <li><a href="/websites" className="hover:text-[var(--theme-accent)] transition-colors">Websites</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-40">Legal</h4>
          <ul className="flex flex-col gap-4">
            <li><a href="#" className="hover:text-[var(--theme-accent)] transition-colors">Privacy</a></li>
            <li><a href="#" className="hover:text-[var(--theme-accent)] transition-colors">Terms</a></li>
            <li><a href="#" className="hover:text-[var(--theme-accent)] transition-colors">Compliance</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-white/40">
          © 2026 Relentify. Solo. Team. Enterprise.
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            System Operational
          </span>
        </div>
      </div>
    </footer>
  );
}
