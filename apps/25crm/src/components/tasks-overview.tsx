'use client';

import { Checkbox } from "@relentify/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@relentify/ui";
import { Badge } from "@relentify/ui";
import { Skeleton } from "@relentify/ui";
import { format } from "date-fns";
import React from "react";

export function TasksOverview() {
  const [allTasks, setAllTasks] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
          const data = await res.json();
          setAllTasks(data);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const upcomingTasks = React.useMemo(() => {
    return allTasks
      .filter(t => t.status !== 'Completed')
      .slice(0, 5);
  }, [allTasks]);

  const handleTaskCheckedChange = (taskId: string, currentStatus: string) => {
    // For now, optimistic local update
    const newStatus = currentStatus === 'Completed' ? 'To Do' : 'Completed';
    setAllTasks(allTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'To Do': case 'Open': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      default: return 'secondary';
    }
  }

  const getTimestampAsDate = (date: any): Date => {
    if (!date) return new Date();
    return new Date(date);
  };

  const pendingTasksCount = allTasks.filter(t => t.status !== 'Completed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Upcoming Tasks</CardTitle>
        {isLoading ? (
            <Skeleton className="h-4 w-1/3" />
        ) : (
            <CardDescription>You have {pendingTasksCount} pending tasks.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading && !upcomingTasks ? (
            Array.from({length: 3}).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4" />
                        <div className="grid gap-0.5">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            ))
          ) : (
            upcomingTasks?.map((task) => (
              <div key={task.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    id={`task-overview-${task.id}`} 
                    checked={task.status === 'Completed'}
                    onCheckedChange={() => handleTaskCheckedChange(task.id, task.status)}
                  />
                  <div className="grid gap-0.5">
                    <label htmlFor={`task-overview-${task.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {task.title}
                    </label>
                    <p className="text-xs text-muted-foreground">Due: {format(getTimestampAsDate(task.due_date), 'PP')}</p>
                  </div>
                </div>
                <Badge variant={getStatusVariant(task.status)} className="capitalize">{task.status}</Badge>
              </div>
            ))
          )}
          {!isLoading && upcomingTasks?.length === 0 && (
            <p className="text-sm text-center py-4 text-muted-foreground">You have no upcoming tasks.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
