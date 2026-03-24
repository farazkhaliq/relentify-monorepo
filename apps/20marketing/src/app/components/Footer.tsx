import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../App';

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer
      className="mt-20 pt-20 pb-10 px-6 rounded-t-[4rem]"
      style={{ backgroundColor: theme.palette.dark, color: 'white' }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <h2 className={`text-3xl font-bold tracking-tighter mb-4 ${theme.typography.headings}`}>
            RELENTIFY
          </h2>
          <p className="opacity-60 max-w-sm mb-8">
            The integrated business suite built for small companies that move fast.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-40">Product</h4>
          <ul className="flex flex-col gap-4">
            <li><Link to="/accounting" className="hover:text-accent transition-colors">Accounting</Link></li>
            <li><Link to="/inventory" className="hover:text-accent transition-colors">Property Inventories</Link></li>
            <li><Link to="/crm" className="hover:text-accent transition-colors">CRM</Link></li>
            <li><Link to="/timesheets" className="hover:text-accent transition-colors">Timesheets</Link></li>
            <li><Link to="/esign" className="hover:text-accent transition-colors">E-Sign</Link></li>
            <li><Link to="/payroll" className="hover:text-accent transition-colors">Payroll & HR</Link></li>
            <li><Link to="/websites" className="hover:text-accent transition-colors">Websites</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-40">Legal</h4>
          <ul className="flex flex-col gap-4">
            <li><Link to="/privacy" className="hover:text-accent transition-colors">Privacy</Link></li>
            <li><a href="#" className="hover:text-accent transition-colors">Terms</a></li>
            <li><a href="#" className="hover:text-accent transition-colors">Compliance</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-[var(--theme-border)] flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm opacity-40">
          © 2026 Relentify. Solo. Team. Enterprise.
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--theme-success)] animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
            System Operational
          </span>
        </div>
      </div>
    </footer>
  );
}
