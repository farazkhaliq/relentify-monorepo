'use client';

import { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Zap, 
  Trophy,
  RotateCcw,
  Layout
} from 'lucide-react';
import { Button, Card, Badge, StatsCard, cn } from '@relentify/ui';
import { motion, AnimatePresence } from 'framer-motion';

export function MomentumView({ initialTasks, user }: any) {
  const [tasks, setTasks] = useState(initialTasks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);

  const currentTask = tasks[currentIndex];

  const handleComplete = async () => {
    if (!currentTask) return;
    await fetch(`/api/tasks/${currentTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed' }),
    });
    setPoints(prev => prev + 10);
    setStreak(prev => prev + 1);

    const newTasks = [...tasks];
    newTasks.splice(currentIndex, 1);
    setTasks(newTasks);
    if (currentIndex >= newTasks.length) {
      setCurrentIndex(Math.max(0, newTasks.length - 1));
    }
  };

  const handleSnooze = async () => {
    if (!currentTask) return;
    const newDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await fetch(`/api/tasks/${currentTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ due_date: newDueDate }),
    });
    setCurrentIndex((prev) => (prev + 1) % tasks.length);
  };

  const handleSkip = () => {
    setCurrentIndex((prev) => (prev + 1) % tasks.length);
  };

  if (tasks.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 text-center"
      >
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--theme-accent)]/10 shadow-[0_0_var(--theme-size-30)_rgba(var(--theme-accent-rgb),0.2)]">
          <Trophy className="h-12 w-12 text-[var(--theme-accent)]" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tighter text-[var(--theme-text)]">Deck Cleared!</h2>
        <p className="mt-4 text-[var(--theme-text-muted)] font-medium">You've mastered all your tasks for now.</p>
        <div className="mt-8 flex gap-4">
           <Button onClick={() => window.location.href = '/dashboard'} className="font-bold px-8 h-10 transition-colors">Return to Dashboard</Button>
           <Button variant="outline" className="transition-colors font-bold px-8 h-10">View Activity</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Task {currentIndex + 1} of {tasks.length}</span>
            <div className="mt-1 flex h-1.5 w-32 overflow-hidden rounded-full bg-[var(--theme-border)]">
               <div 
                 className="h-full bg-[var(--theme-accent)] transition-all duration-500 shadow-[0_0_var(--theme-size-10)_rgba(var(--theme-accent-rgb),0.5)]" 
                 style={{ width: `${((currentIndex + 1) / tasks.length) * 100}%` }} 
               />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StatsCard 
            label="Points" 
            value={`${points} PTS`} 
            icon={Zap} 
            className="h-auto p-0 border-none bg-transparent shadow-none"
          />
          <div className="h-8 w-px bg-[var(--theme-border)]" />
          <StatsCard 
            label="Streak" 
            value={`${streak} DAYS`} 
            className="h-auto p-0 border-none bg-transparent shadow-none"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentTask.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8 shadow-[var(--shadow-cinematic)]">
            <div className="p-0 space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="border-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-bold uppercase tracking-widest text-[var(--theme-text-10)]">
                  {currentTask.priority} PRIORITY
                </Badge>
                <h3 className="text-4xl font-black uppercase tracking-tight text-[var(--theme-text)] leading-tight">
                  {currentTask.title}
                </h3>
                <p className="text-lg text-[var(--theme-text-muted)] font-medium leading-relaxed">
                  {currentTask.description || 'No detailed notes for this task.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[var(--theme-border)]">
                <div className="flex items-center gap-2 text-[var(--theme-text-muted)]">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    Due {currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : 'Today'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[var(--theme-text-muted)]">
                  <Layout className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {currentTask.parent_title || 'General'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Button 
          onClick={handleComplete}
          className="h-24 flex-col gap-2 shadow-cinematic shadow-[var(--theme-accent)]/20 transition-all active:scale-95 rounded-cinematic flex items-center justify-center"
        >
          <CheckCircle2 className="h-8 w-8" />
          <span className="text-xs font-black uppercase tracking-widest">Done</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleSnooze}
          className="h-24 flex-col gap-2 bg-[var(--theme-background)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all active:scale-95 rounded-cinematic flex items-center justify-center"
        >
          <Clock className="h-8 w-8" />
          <span className="text-xs font-black uppercase tracking-widest">Snooze</span>
        </Button>
        <Button 
          variant="outline"
          className="h-24 flex-col gap-2 bg-[var(--theme-background)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all active:scale-95 rounded-cinematic flex items-center justify-center"
        >
          <Calendar className="h-8 w-8" />
          <span className="text-xs font-black uppercase tracking-widest">Schedule</span>
        </Button>
        <Button 
          variant="ghost"
          onClick={handleSkip}
          className="h-24 flex-col gap-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all active:scale-95 rounded-cinematic flex items-center justify-center"
        >
          <ArrowRight className="h-8 w-8" />
          <span className="text-xs font-black uppercase tracking-widest">Skip</span>
        </Button>
      </div>

      <div className="flex justify-center pt-8">
         <Button 
           variant="ghost"
           onClick={() => window.location.href = '/dashboard'}
           className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] px-4 h-8 rounded-cinematic transition-colors flex items-center"
         >
           <RotateCcw className="mr-2 h-3 w-3" />
           Cancel Momentum Mode
         </Button>
      </div>
    </div>
  );
}