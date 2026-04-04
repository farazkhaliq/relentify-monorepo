'use client';

import { Card } from '@relentify/ui';
import { cn } from '@relentify/ui';
import { Clock, CheckCircle2, Circle, XCircle } from 'lucide-react';

const statuses = [
  { name: 'To Start', icon: Circle, color: 'text-[var(--theme-text-muted)]', bg: 'bg-[var(--theme-text-muted)]/10' },
  { name: 'In Progress', icon: Clock, color: 'text-[var(--theme-warning)]', bg: 'bg-[var(--theme-warning)]/10' },
  { name: 'Completed', icon: CheckCircle2, color: 'text-[var(--theme-accent)]', bg: 'bg-[var(--theme-accent)]/10' },
  { name: 'Cancelled', icon: XCircle, color: 'text-[var(--theme-text-muted)]', bg: 'bg-[var(--theme-text-muted)]/5' },
];

export function TaskKanban({ tasks }: any) {
  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4 min-h-[var(--theme-size-500)]">
      {statuses.map((s) => (
        <div key={s.name} className="flex min-w-[var(--theme-size-300)] flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <h3 className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">{s.name}</h3>
              <span className="rounded-full bg-[var(--theme-border)] px-2 py-0.5 text-[var(--theme-text-10)] font-bold text-[var(--theme-text-muted)]">
                {tasks.filter((t: any) => t.status === s.name).length}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {tasks
              .filter((t: any) => t.status === s.name)
              .map((task: any) => (
                <Card key={task.id} className="p-4 space-y-3 hover:border-[var(--theme-accent)]/30 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-bold text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors leading-tight">
                      {task.title}
                    </h4>
                  </div>
                  {task.description && (
                    <p className="text-xs text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex -space-x-1.5">
                       <div className="h-5 w-5 rounded-full bg-[var(--theme-border)] flex items-center justify-center ring-2 ring-[var(--theme-background)]">
                         <span className="text-[var(--theme-text-8)] text-[var(--theme-text-muted)]">?</span>
                       </div>
                    </div>
                    {task.due_date && (
                      <span className="text-[var(--theme-text-10)] font-bold text-[var(--theme-text-muted)] uppercase tracking-tighter">
                        Due {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
