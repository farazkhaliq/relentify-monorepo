'use client';

export function TaskGantt({ tasks }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-[var(--theme-text-muted)] min-h-[var(--theme-size-400)]">
      <h3 className="text-lg font-black uppercase tracking-widest text-[var(--theme-text)] mb-2">Gantt Chart</h3>
      <p className="text-sm font-medium">Timeline view for task dependencies and scheduling.</p>
      
      <div className="mt-8 w-full max-w-4xl border border-[var(--theme-border)] rounded-cinematic bg-[var(--theme-background)] p-4 space-y-4">
        {tasks.slice(0, 5).map((t: any, i: number) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-24 shrink-0 text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)] truncate">{t.title}</div>
            <div className="relative flex-1 h-6 bg-[var(--theme-border)] dark:bg-[var(--theme-border)] rounded-full overflow-hidden">
               <div 
                 className="absolute h-full bg-[var(--theme-accent)]/40 rounded-full border border-[var(--theme-accent)]/30 shadow-[0_0_var(--theme-size-10)_rgba(var(--theme-accent-rgb),0.2)]" 
                 style={{ width: `${Math.random() * 40 + 20}%`, left: `${Math.random() * 20}%` }}
               />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
