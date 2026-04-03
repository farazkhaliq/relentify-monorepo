'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';
import { motion } from 'motion/react';
import { Bell, CheckCircle2, Zap, Calendar, Repeat, Smartphone, ArrowRight, Clock, Target, Flame } from 'lucide-react';

export default function Reminders() {
  const { theme } = useTheme();

  const views = [
    { label: 'My Day', active: true },
    { label: 'Upcoming', active: false },
    { label: 'Projects', active: false },
    { label: 'Team', active: false },
  ];

  const tasks = [
    { title: 'Send invoice to TechCorp', due: 'Today, 5pm', priority: 'high', done: false, tag: 'Finance' },
    { title: 'Review Q1 budget report', due: 'Today, 3pm', priority: 'medium', done: true, tag: 'Accounts' },
    { title: 'Call supplier re: delivery', due: 'Tomorrow', priority: 'high', done: false, tag: 'Inventory' },
    { title: 'Update employee contracts', due: 'Fri, 14 Mar', priority: 'low', done: false, tag: 'HR' },
  ];

  const features = [
    {
      icon: <Bell size={28} />,
      title: 'Persistent Reminders',
      desc: 'Tasks don\'t vanish until you act. Relentify keeps nudging you — at the right time, on the right device — until the job is done.'
    },
    {
      icon: <Repeat size={28} />,
      title: 'Recurring Tasks',
      desc: 'Set it once. Monthly invoices, weekly check-ins, daily standups — recurring tasks regenerate automatically, so nothing ever slips.'
    },
    {
      icon: <Target size={28} />,
      title: 'Momentum Mode',
      desc: 'Focus mode that surfaces only today\'s critical tasks. Eliminate distractions and close your day with a full green list.'
    },
    {
      icon: <Smartphone size={28} />,
      title: 'Mobile-First',
      desc: 'Full-featured on mobile. Check off tasks on the go, set voice reminders, and get push notifications that actually respect your calendar.'
    },
    {
      icon: <Zap size={28} />,
      title: 'Business-Aware',
      desc: 'Linked to Accounting, CRM, and HR. Tasks can trigger actions — send an invoice, log a meeting, schedule a pay run — all in one tap.'
    },
    {
      icon: <Flame size={28} />,
      title: 'Streak & Streaks',
      desc: 'Build momentum with completion streaks. Teams that finish tasks consistently unlock productivity insights and leaderboard rankings.'
    }
  ];

  return (
    <div className="w-full pt-32">

      {/* Hero */}
      <section className="px-6 max-w-7xl mx-auto mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          {/* Phone mockup */}
          <div className="order-2 lg:order-1">
            <div className="relative bg-[var(--theme-border)] rounded-cinematic p-12 overflow-hidden border border-[var(--theme-border)]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-32 -mt-32" />

              {/* Phone frame */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                className="relative z-10 mx-auto w-64 aspect-[9/19] bg-[var(--theme-card)] rounded-[3rem] border-8 border-[var(--theme-dark)] shadow-cinematic overflow-hidden"
              >
                {/* Status bar */}
                <div className="h-8 bg-[var(--theme-card)] flex items-center justify-between px-4">
                  <span className="text-[var(--theme-text-10)] font-bold text-[var(--theme-text)]">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-[var(--theme-text)] rounded-sm" />
                    <div className="w-1 h-2.5 bg-[var(--theme-text)] rounded-sm" />
                    <div className="w-1 h-2 bg-[var(--theme-text)] rounded-sm opacity-50" />
                  </div>
                </div>

                {/* App header */}
                <div className="px-4 py-3 border-b border-[var(--theme-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[var(--theme-text-80)] font-bold text-[var(--theme-text)]">My Day</span>
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
                      <Bell size={12} className="text-accent" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {views.map((v, i) => (
                      <span key={i} className={`text-[var(--theme-text-70)] font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${v.active ? 'bg-accent text-white' : 'text-[var(--theme-text-muted)]'}`}>
                        {v.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Task list */}
                <div className="px-3 py-3 space-y-2 overflow-hidden">
                  {tasks.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: 20, opacity: 0 }}
                      whileInView={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-2 p-2 bg-[var(--theme-border)] rounded-xl"
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${t.done ? 'bg-[var(--theme-success)] border-[var(--theme-success)]' : t.priority === 'high' ? 'border-[var(--theme-destructive)]' : 'border-[var(--theme-border)]'}`}>
                        {t.done && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[var(--theme-text-70)] font-bold leading-tight ${t.done ? 'line-through text-[var(--theme-text-dim)]' : 'text-[var(--theme-text)]'}`}>{t.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock size={8} className="text-[var(--theme-text-muted)]" />
                          <span className="text-[var(--theme-text-9)] text-[var(--theme-text-muted)]">{t.due}</span>
                          <span className="text-[var(--theme-text-9)] font-bold text-accent bg-accent/10 px-1 py-0.5 rounded">{t.tag}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Momentum strip */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-4">
                  <div className="bg-[var(--theme-success)]/10 border border-[var(--theme-success)]/20 rounded-xl p-2 flex items-center gap-2">
                    <Flame size={14} className="text-[var(--theme-success)]" />
                    <span className="text-[var(--theme-text-9)] font-bold text-[var(--theme-success)] uppercase tracking-widest">5-day streak</span>
                  </div>
                </div>
              </motion.div>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="absolute top-8 right-4 px-4 py-2 bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] z-20"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--theme-success)]" />
                  <span className="text-[var(--theme-text-75)] font-bold">3 done today</span>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute bottom-8 right-4 px-4 py-2 bg-[var(--theme-card)] rounded-cinematic shadow-cinematic border border-[var(--theme-border)] z-20"
              >
                <div className="flex items-center gap-2">
                  <Bell size={12} className="text-accent" />
                  <span className="text-[var(--theme-text-75)] font-bold">Invoice reminder sent</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Copy */}
          <div className="order-1 lg:order-2">
            <span className="text-sm font-bold uppercase tracking-widest text-accent mb-6 block">Relentify Reminders</span>
            <h1 className={`text-6xl md:text-8xl font-bold leading-[0.9] mb-8 ${theme.typography.headings}`}>
              Tasks that <span className={theme.typography.drama}>Actually Get Done.</span>
            </h1>
            <p className="text-xl text-[var(--theme-text-muted)] max-w-xl mb-10">
              Most task apps let you forget things elegantly. Relentify Reminders doesn't. Persistent, context-aware nudges that chase your tasks to completion — across every device, every day.
            </p>
            <div className="space-y-6 mb-12">
              {[
                'Persistent reminders until the job is done',
                'Recurring tasks that regenerate automatically',
                'Momentum Mode for focused daily execution',
                'Linked to Accounting, CRM & HR modules',
                'Team tasks, shared lists & completion streaks',
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

      {/* Features grid */}
      <section className="py-32 px-6 bg-[var(--theme-background)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={`text-5xl md:text-7xl font-bold mb-6 ${theme.typography.headings}`}>
              Built for <span className="text-accent">Momentum.</span>
            </h2>
            <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
              Not another todo list. A system designed to eliminate the gap between knowing what needs doing and actually doing it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-[var(--theme-card)] rounded-cinematic p-10 border border-[var(--theme-border)] shadow-cinematic flex flex-col gap-6"
              >
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-bold">{f.title}</h3>
                <p className="text-[var(--theme-text-muted)] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Multiple views demo */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className={`text-5xl md:text-7xl font-bold mb-8 ${theme.typography.headings}`}>
                Every View <span className={theme.typography.drama}>You Need.</span>
              </h2>
              <p className="text-xl text-[var(--theme-text-muted)] mb-10 leading-relaxed">
                Switch between My Day, Upcoming, Board, and Calendar views. Whether you're a list person or a visual planner, Relentify adapts to how you think — not the other way around.
              </p>
              <div className="space-y-4">
                {[
                  { view: 'My Day', desc: 'Focused list of today\'s must-dos, auto-populated from your schedule' },
                  { view: 'Board View', desc: 'Kanban-style columns for project and pipeline management' },
                  { view: 'Calendar', desc: 'See all tasks and deadlines mapped to your working week' },
                  { view: 'Team View', desc: 'Assign tasks, track progress, and hold your team accountable' },
                ].map((v, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-[var(--theme-card)] rounded-xl border border-[var(--theme-border)] shadow-cinematic">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <p className="font-bold mb-1">{v.view}</p>
                      <p className="text-sm text-[var(--theme-text-muted)]">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Board view mockup */}
            <div className="bg-[var(--theme-border)] rounded-cinematic p-8 border border-[var(--theme-border)]">
              <div className="mb-6">
                <p className="text-[var(--theme-text-10)] font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-1">Board View</p>
                <h4 className="font-bold text-lg">March Sprint</h4>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { col: 'To Do', color: 'var(--theme-border)', tasks: ['Email templates', 'Staff rota'] },
                  { col: 'In Progress', color: 'var(--theme-warning)', tasks: ['VAT return', 'Stock audit'] },
                  { col: 'Done', color: 'var(--theme-success)', tasks: ['Invoice batch', 'P11D forms', 'Team payroll'] },
                ].map((col, i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(${col.color.replace('var(', '').replace(')', '')})` }} />
                      <span className="text-[var(--theme-text-75)] font-bold">{col.col}</span>
                    </div>
                    {col.tasks.map((t, j) => (
                      <div key={j} className="bg-[var(--theme-card)] rounded-xl p-3 border border-[var(--theme-border)] shadow-cinematic">
                        <p className="text-[var(--theme-text-75)] font-bold leading-tight">{t}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-[var(--theme-dark)] rounded-cinematic p-12 md:p-20 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[var(--theme-background-blur)]" />
          <div className="relative z-10">
            <h2 className={`text-4xl md:text-6xl font-bold mb-6 ${theme.typography.headings}`}>Stop forgetting. Start delivering.</h2>
            <p className="text-xl text-[var(--theme-text-muted)] mb-12 max-w-xl mx-auto">
              Reserve your free trial now and be first in line when Relentify Reminders launches. Your whole team, 30 days free.
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
