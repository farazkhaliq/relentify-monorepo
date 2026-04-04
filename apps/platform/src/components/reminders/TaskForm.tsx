'use client';

import { useState } from 'react';
import { X, Repeat, Settings2, Trash2 } from 'lucide-react';
import { Button, Input, Label, Textarea, NativeSelect as Select } from '@relentify/ui';

export function TaskForm({ task, onClose, onSubmit, onDelete, workspaceId, listId }: any) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'To Start',
    priority: task?.priority || 'Normal',
    due_date: task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
    start_date: task?.start_date ? new Date(task.start_date).toISOString().split('T')[0] : '',
    parent_task_id: task?.parent_task_id || '',
    owners: task?.owners || [],
    heads_up: task?.heads_up || [],
    recurring_rule: task?.recurring_rule || null,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    onSubmit({ ...formData, list_id: listId });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-end bg-[var(--theme-primary)]/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
      <div className="h-full w-full max-w-xl border-l border-[var(--theme-border)] bg-[var(--theme-background)] shadow-[var(--shadow-cinematic)] animate-in slide-in-from-right duration-300 overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-full">
          <header className="sticky top-0 z-10 border-b border-[var(--theme-border)] bg-[var(--theme-background)] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" type="button" onClick={onClose} className="h-8 w-8 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center justify-center rounded-cinematic transition-colors">
                <X className="h-5 w-5" />
              </Button>
              <h2 className="text-sm font-black uppercase tracking-widest text-[var(--theme-text-muted)]">
                {task ? 'Edit Task' : 'New Task'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" className="h-9 font-bold">
                Save Task
              </Button>
            </div>
          </header>

          <div className="flex-1 p-6 space-y-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Input 
                  autoFocus
                  placeholder="Task title..."
                  className="h-14 bg-transparent border-none text-2xl font-black uppercase tracking-tighter placeholder:text-[var(--theme-text-muted)] ring-0 focus:ring-0 p-0"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <Textarea 
                placeholder="Add a description or notes..."
                className="w-full min-h-[var(--theme-size-120)] bg-[var(--theme-border)]/20 border border-[var(--theme-border)] rounded-cinematic p-4 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] transition-all resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Status</Label>
                 <Select 
                   className="w-full h-11 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic px-3 text-sm font-bold text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)] transition-all"
                   value={formData.status}
                   onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                 >
                   <option>To Start</option>
                   <option>In Progress</option>
                   <option>Completed</option>
                   <option>Cancelled</option>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Priority</Label>
                 <Select 
                   className="w-full h-11 bg-[var(--theme-background)] border border-[var(--theme-border)] rounded-cinematic px-3 text-sm font-bold text-[var(--theme-text)] outline-none focus:border-[var(--theme-accent)] transition-all"
                   value={formData.priority}
                   onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                 >
                   <option>Low</option>
                   <option>Normal</option>
                   <option>High</option>
                   <option>Urgent</option>
                 </Select>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Due Date</Label>
                 <Input 
                   type="date"
                   className="h-11 bg-[var(--theme-background)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                   value={formData.due_date}
                   onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Start Date</Label>
                 <Input 
                    type="date"
                    className="h-11 bg-[var(--theme-background)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
               </div>
            </div>

            <div className="space-y-4 pt-4">
              <button 
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
              </button>

              {showAdvanced && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Parent Task ID</Label>
                    <Input 
                      placeholder="Paste task ID..."
                      className="h-11 bg-[var(--theme-background)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                      value={formData.parent_task_id}
                      onChange={(e) => setFormData({ ...formData, parent_task_id: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[var(--theme-text-10)] font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Recurring</Label>
                    <div className="flex items-center gap-3 p-4 bg-[var(--theme-border)]/20 border border-[var(--theme-border)] rounded-cinematic">
                      <Repeat className="h-5 w-5 text-[var(--theme-text-muted)]" />
                      <div>
                        <p className="text-xs font-bold text-[var(--theme-text)]">None</p>
                        <p className="text-[var(--theme-text-10)] text-[var(--theme-text-muted)] uppercase tracking-widest">Repeats weekly, monthly etc.</p>
                      </div>
                      <Button variant="outline" type="button" className="ml-auto text-[var(--theme-text-10)] h-7 px-2 font-black rounded-cinematic">SET RULE</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="mt-auto border-t border-[var(--theme-border)] bg-[var(--theme-background)] p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {task && onDelete && (
                <Button variant="ghost" type="button" onClick={() => { onDelete(task.id); onClose(); }} className="text-[var(--theme-text-10)] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] transition-colors uppercase tracking-widest px-2 h-8 rounded-cinematic flex items-center">
                  <Trash2 className="mr-2 h-3 w-3" />
                  Delete Task
                </Button>
              )}
            </div>
            <p className="text-[var(--theme-text-10)] font-medium text-[var(--theme-text-muted)] uppercase tracking-widest">Created by {task?.created_by || 'Me'}</p>
          </footer>
        </form>
      </div>
    </div>
  );
}