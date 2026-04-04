'use client';

export function TaskCalendar({ tasks }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-[var(--theme-text-muted)]">
      <h3 className="text-lg font-black uppercase tracking-widest text-[var(--theme-text)] mb-2">Calendar View</h3>
      <p className="text-sm font-medium">Standard calendar component rendering {tasks.length} tasks.</p>
      <div className="mt-8 grid grid-cols-7 gap-px bg-[var(--theme-border)] border border-[var(--theme-border)] rounded-cinematic overflow-hidden w-full max-w-4xl aspect-[1.5/1]">
        {Array.from({ length: 31 }).map((_, i) => (
          <div key={i} className="bg-[var(--theme-background)] p-2 min-h-[var(--theme-size-60)] text-[var(--theme-text-10)] font-black text-[var(--theme-text-muted)] opacity-50">
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
