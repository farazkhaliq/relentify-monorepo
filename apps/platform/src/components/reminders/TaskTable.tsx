'use client';

import { format, isPast, isToday } from 'date-fns';
import { 
  Circle, 
  CheckCircle2, 
  Clock, 
  MoreVertical, 
  User,
  Calendar
} from 'lucide-react';
import { 
  Badge, 
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@relentify/ui';
import { cn } from '@relentify/ui';

export function TaskTable({ tasks, onEdit, onStatusChange }: any) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return <CheckCircle2 className="h-4 w-4 text-[var(--theme-accent)]" />;
      case 'In Progress': return <Clock className="h-4 w-4 text-[var(--theme-warning)]" />;
      case 'Cancelled': return <Circle className="h-4 w-4 text-[var(--theme-text-muted)] line-through" />;
      default: return <Circle className="h-4 w-4 text-[var(--theme-text-muted)]" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent': return <Badge variant="destructive" className="uppercase text-[var(--theme-text-10)]">Urgent</Badge>;
      case 'High': return <Badge variant="outline" className="uppercase text-[var(--theme-text-10)]">High</Badge>;
      case 'Low': return <Badge variant="outline" className="text-[var(--theme-text-muted)] uppercase text-[var(--theme-text-10)]">Low</Badge>;
      default: return <Badge variant="outline" className="text-[var(--theme-accent)] border-[var(--theme-accent)]/20 uppercase text-[var(--theme-text-10)]">Normal</Badge>;
    }
  };

  const formatDueDate = (date: any) => {
    if (!date) return <span className="text-[var(--theme-border)]">—</span>;
    const d = new Date(date);
    return (
      <span className={cn(
        "text-xs font-medium",
        isPast(d) && !isToday(d) ? "text-[var(--theme-destructive)]" : isToday(d) ? "text-[var(--theme-warning)]" : "text-[var(--theme-text-muted)]"
      )}>
        {format(d, 'dd MMM')}
      </span>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[var(--theme-border)] dark:bg-[var(--theme-border)]">
          <TableHead className="w-10 px-4"></TableHead>
          <TableHead className="px-4">Task Title</TableHead>
          <TableHead className="px-4">Status</TableHead>
          <TableHead className="px-4">Priority</TableHead>
          <TableHead className="px-4">Due Date</TableHead>
          <TableHead className="px-4">Owner</TableHead>
          <TableHead className="px-4">Parent</TableHead>
          <TableHead className="w-10 px-4 text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task: any) => (
          <TableRow 
            key={task.id} 
            className={cn(
              "group cursor-pointer",
              task.parent_task_id ? "bg-[var(--theme-border)]/20 dark:bg-[var(--theme-border)]/20" : ""
            )}
            onClick={() => onEdit(task)}
          >
            <TableCell className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, task.status === 'Completed' ? 'To Start' : 'Completed'); }}>
              {getStatusIcon(task.status)}
            </TableCell>
            <TableCell className="px-4 py-3">
              <div className="flex items-center gap-2">
                {task.parent_task_id && <div className="h-4 w-4 border-l-2 border-b-2 border-[var(--theme-border)] rounded-bl-sm" />}
                <span className={cn(
                  "text-sm font-semibold tracking-tight",
                  task.status === 'Completed' ? "text-[var(--theme-text-muted)] line-through" : "text-[var(--theme-text)]"
                )}>
                  {task.title}
                </span>
              </div>
            </TableCell>
            <TableCell className="px-4 py-3">
              <span className="text-[var(--theme-text-10)] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">{task.status}</span>
            </TableCell>
            <TableCell className="px-4 py-3">
              {getPriorityBadge(task.priority)}
            </TableCell>
            <TableCell className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-[var(--theme-text-muted)]" />
                {formatDueDate(task.due_date)}
              </div>
            </TableCell>
            <TableCell className="px-4 py-3">
              <div className="flex -space-x-1.5 overflow-hidden">
                {(task.owners || []).map((o: any, i: number) => (
                  <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-[var(--theme-background)] bg-[var(--theme-border)] flex items-center justify-center">
                    <User className="h-3 w-3 text-[var(--theme-text-muted)]" />
                  </div>
                ))}
                {(!task.owners || task.owners.length === 0) && <span className="text-[var(--theme-border)] text-xs">—</span>}
              </div>
            </TableCell>
            <TableCell className="px-4 py-3">
              <span className="text-xs text-[var(--theme-text-muted)] truncate max-w-[var(--theme-size-120)] block">
                {task.parent_title || ''}
              </span>
            </TableCell>
            <TableCell className="px-4 py-3 text-right">
               <Button variant="ghost" className="h-8 w-8 text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors rounded-cinematic flex items-center justify-center ml-auto">
                 <MoreVertical className="h-4 w-4" />
               </Button>
            </TableCell>
          </TableRow>
        ))}
        {tasks.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="py-12 text-center text-[var(--theme-text-muted)] font-medium">
              No tasks found. Start by adding one above.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
