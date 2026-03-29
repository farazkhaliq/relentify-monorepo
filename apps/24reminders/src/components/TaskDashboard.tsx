'use client';

import { useState } from 'react';
import { 
  List as ListIcon, 
  Columns, 
  Calendar as CalendarIcon, 
  BarChart, 
  Plus, 
} from 'lucide-react';
import { Button, Input, Card } from '@relentify/ui';
import { cn } from '@relentify/ui';
import { TaskTable } from './TaskTable';
import { TaskKanban } from './TaskKanban';
import { TaskCalendar } from './TaskCalendar';
import { TaskGantt } from './TaskGantt';
import { TaskForm } from './TaskForm';

type ViewMode = 'list' | 'kanban' | 'calendar' | 'gantt';

export function TaskDashboard({ initialTasks, user, listId, workspaceId }: any) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<ViewMode>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [search, setSearch] = useState('');

  const filteredTasks = tasks.filter((t: any) => 
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTask = async (data: any) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const newTask = await res.json();
    setTasks([newTask, ...tasks]);
    setShowForm(false);
  };

  const handleUpdateTask = async (id: string, data: any) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setTasks(tasks.map((t: any) => t.id === id ? { ...t, ...data } : t));
    setEditingTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(tasks.filter((t: any) => t.id !== id));
    setEditingTask(null);
  };

  const viewIcons = [
    { id: 'list', icon: ListIcon, label: 'Table' },
    { id: 'kanban', icon: Columns, label: 'Kanban' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'gantt', icon: BarChart, label: 'Gantt' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-lg">
          <Input 
            placeholder="Add a task... (e.g. Call John tomorrow @John)" 
            className="pl-10 h-11 bg-[var(--theme-background)] border-[var(--theme-border)] focus:border-[var(--theme-accent)] transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Plus className="absolute left-3 top-3 h-5 w-5 text-[var(--theme-text-muted)]" />
          <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
             <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-[var(--theme-border)] bg-[var(--theme-background)] px-1.5 font-mono text-[var(--theme-text-10)] font-medium text-[var(--theme-text-muted)]">
               <span className="text-xs">⌘</span>K
             </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-cinematic bg-[var(--theme-background)] p-1 border border-[var(--theme-border)]">
            {viewIcons.map((v) => (
              <Button
                key={v.id}
                variant="ghost"
                onClick={() => setView(v.id as ViewMode)}
                className={cn(
                  "h-8 px-3 text-xs font-bold uppercase tracking-wider transition-all rounded-cinematic flex items-center",
                  view === v.id ? "bg-[var(--theme-border)] text-[var(--theme-accent)] border border-[var(--theme-border)]" : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
                )}
              >
                <v.icon className="mr-2 h-3.5 w-3.5" />
                {v.label}
              </Button>
            ))}
          </div>

          <Button 
            onClick={() => setShowForm(true)}
            className="h-10 font-bold shadow-cinematic shadow-[var(--theme-accent)]/20 rounded-cinematic px-4 flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      <Card className="border-[var(--theme-border)] overflow-hidden">
        {view === 'list' && (
          <TaskTable 
            tasks={filteredTasks} 
            onEdit={(t: any) => setEditingTask(t)}
            onStatusChange={(id: string, s: string) => handleUpdateTask(id, { status: s })}
          />
        )}
        {view === 'kanban' && <TaskKanban tasks={filteredTasks} />}
        {view === 'calendar' && <TaskCalendar tasks={filteredTasks} />}
        {view === 'gantt' && <TaskGantt tasks={filteredTasks} />}
      </Card>

      {(showForm || editingTask) && (
        <TaskForm 
          task={editingTask} 
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          onSubmit={editingTask ? (d: any) => handleUpdateTask(editingTask.id, d) : handleCreateTask}
          onDelete={handleDeleteTask}
          workspaceId={workspaceId}
          listId={listId}
        />
      )}
    </div>
  );
}
