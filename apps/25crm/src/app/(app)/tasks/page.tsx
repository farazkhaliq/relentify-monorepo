'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { LayoutGrid, List, User, Flag, PlusCircle, Mail, Home, FileText } from "lucide-react";
import { format } from 'date-fns';

import { Button } from "@relentify/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@relentify/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@relentify/ui";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@relentify/ui";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@relentify/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@relentify/ui";
import { useApiCollection } from '@/hooks/use-api';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { Badge } from '@relentify/ui';
import { EditTaskDialog } from '@/components/edit-task-dialog';
import { SortableTableHead } from '@/components/sortable-table-head';

type TaskStatus = 'To Do' | 'In Progress' | 'Completed';
type SortDirection = 'asc' | 'desc';
type SortableColumns = 'title' | 'due_date' | 'priority';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: any;
  priority: 'High' | 'Medium' | 'Low';
  status: TaskStatus;
  related_type?: string;
  related_id?: string;
  user_id?: string;
}

const statusColumns: TaskStatus[] = ['To Do', 'In Progress', 'Completed'];

const priorityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export default function TasksPage() {
  // State for filters, sorting, and dialogs
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortDescriptor, setSortDescriptor] = useState<{ column: SortableColumns; direction: SortDirection }>({ column: 'due_date', direction: 'asc' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { userProfile, isLoading: loadingCurrentUser } = useUserProfile();

  const { data: tasks, isLoading: loadingTasks } = useApiCollection<Task>('/api/tasks');

  const filteredAndSortedTasks = useMemo(() => {
    let processedTasks = tasks || [];

    // Apply filters
    if (priorityFilter !== 'all') {
      processedTasks = processedTasks.filter(task => task.priority === priorityFilter);
    }

    // Apply sorting
    processedTasks = [...processedTasks].sort((a, b) => {
      const { column, direction } = sortDescriptor;
      let aValue: any, bValue: any;

      switch(column) {
        case 'due_date':
            aValue = getDateAsTime(a.due_date);
            bValue = getDateAsTime(b.due_date);
            break;
        case 'priority':
            aValue = priorityOrder[a.priority] || 0;
            bValue = priorityOrder[b.priority] || 0;
            break;
        default:
            aValue = (a as any)[column];
            bValue = (b as any)[column];
      }

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return direction === 'desc' ? comparison * -1 : comparison;
    });

    return processedTasks;
  }, [tasks, priorityFilter, sortDescriptor]);

  const tasksByStatus = useMemo(() => {
    const initial: Record<TaskStatus, Task[]> = { 'To Do': [], 'In Progress': [], 'Completed': [] };
    return filteredAndSortedTasks.reduce((acc, task) => {
      const status = task.status as TaskStatus;
      if (acc[status]) {
        acc[status].push(task);
      }
      return acc;
    }, initial);
  }, [filteredAndSortedTasks]);

  const handleSort = (column: SortableColumns) => {
    if (sortDescriptor.column === column) {
      setSortDescriptor({ ...sortDescriptor, direction: sortDescriptor.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortDescriptor({ column, direction: 'asc' });
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
        case 'High': return 'destructive';
        case 'Medium': return 'default';
        case 'Low': return 'secondary';
        default: return 'outline';
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'To Do': return 'secondary';
        case 'In Progress': return 'default';
        case 'Completed': return 'outline';
        default: return 'secondary';
    }
  }

  const getDateAsTime = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'string') return new Date(val).getTime();
    if (val instanceof Date) return val.getTime();
    return 0;
  };

  const formatDate = (val: any, fmt: string): string => {
    if (!val) return '';
    try {
      const d = typeof val === 'string' ? new Date(val) : val;
      return format(d, fmt);
    } catch {
      return '';
    }
  };

  const isLoading = loadingTasks || loadingCurrentUser;

  return (
    <>
      {editingTask && <EditTaskDialog task={editingTask} open={!!editingTask} onOpenChange={(isOpen) => !isOpen && setEditingTask(null)} />}
      <AddTaskDialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
      <div className="flex flex-col gap-6 h-full">
      <Tabs defaultValue="board" className="flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Tasks</h1>
          </div>
          <div className="flex items-center gap-2">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="board" className="h-7"><LayoutGrid className="h-4 w-4 mr-2" />Board</TabsTrigger>
              <TabsTrigger value="table" className="h-7"><List className="h-4 w-4 mr-2" />Table</TabsTrigger>
            </TabsList>
            <Select value={priorityFilter} onValueChange={setPriorityFilter} disabled={isLoading}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                  <Flag className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9 gap-1" onClick={() => setAddDialogOpen(true)}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">New Task</span>
            </Button>
          </div>
        </div>

        <TabsContent value="board" className="flex-1 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
              {statusColumns.map((status) => (
              <div key={status} className="flex flex-col gap-4 bg-muted/50 p-4 rounded-lg h-full">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                      {status}
                      <span className="text-sm text-muted-foreground bg-background rounded-full px-2 py-0.5">
                          {isLoading ? '...' : tasksByStatus[status].length}
                      </span>
                  </h2>
                  <div className="flex flex-col gap-4 overflow-y-auto">
                      {isLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                              <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-6 w-24" /></CardFooter></Card>
                          ))
                      ) : tasksByStatus[status].length > 0 ? (
                          tasksByStatus[status].map((task) => (
                              <Card key={task.id} className="bg-background cursor-pointer hover:bg-muted/50" onClick={() => setEditingTask(task)}>
                                  <CardHeader>
                                    <CardTitle className="text-base">
                                      <div className="flex items-center justify-between">
                                        <span className="truncate pr-2">{task.title}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <TooltipProvider>
                                            {task.related_type === 'property' && (
                                              <Tooltip><TooltipTrigger><Home className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Property</p></TooltipContent></Tooltip>
                                            )}
                                            {task.related_type === 'contact' && (
                                              <Tooltip><TooltipTrigger><User className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Contact</p></TooltipContent></Tooltip>
                                            )}
                                            {task.related_type === 'tenancy' && (
                                              <Tooltip><TooltipTrigger><FileText className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Tenancy</p></TooltipContent></Tooltip>
                                            )}
                                          </TooltipProvider>
                                        </div>
                                      </div>
                                    </CardTitle>
                                    <CardDescription className="line-clamp-2">{task.description}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                                  </CardContent>
                                  <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
                                      <span>Due: {formatDate(task.due_date, 'MMM d')}</span>
                                  </CardFooter>
                              </Card>
                          ))
                      ) : (
                          <div className="text-sm text-center text-muted-foreground py-8">No tasks match filters.</div>
                      )}
                  </div>
              </div>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="table" className="flex-1 mt-0">
          <Card>
              <CardContent className="p-0">
                  <Table>
                  <TableHeader>
                      <TableRow>
                          <SortableTableHead column="title" title="Task" sortDescriptor={sortDescriptor} onSort={handleSort} className="w-[40%]" />
                          <TableHead>Status</TableHead>
                          <SortableTableHead column="priority" title="Priority" sortDescriptor={sortDescriptor} onSort={handleSort} />
                          <SortableTableHead column="due_date" title="Due Date" sortDescriptor={sortDescriptor} onSort={handleSort} />
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                              </TableRow>
                          ))
                      ) : filteredAndSortedTasks && filteredAndSortedTasks.length > 0 ? (
                      filteredAndSortedTasks.map((task) => (
                          <TableRow key={task.id} className="cursor-pointer" onClick={() => setEditingTask(task)}>
                              <TableCell className="font-medium">
                                  <div className="flex flex-col gap-0.5">
                                      <div className="font-semibold flex items-center gap-2">
                                        <span>{task.title}</span>
                                        <TooltipProvider>
                                            {task.related_type === 'property' && (
                                              <Tooltip><TooltipTrigger><Home className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Property</p></TooltipContent></Tooltip>
                                            )}
                                            {task.related_type === 'contact' && (
                                              <Tooltip><TooltipTrigger><User className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Contact</p></TooltipContent></Tooltip>
                                            )}
                                            {task.related_type === 'tenancy' && (
                                              <Tooltip><TooltipTrigger><FileText className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Tenancy</p></TooltipContent></Tooltip>
                                            )}
                                        </TooltipProvider>
                                      </div>
                                      <span className="text-xs text-muted-foreground line-clamp-1">{task.description}</span>
                                  </div>
                              </TableCell>
                              <TableCell><Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge></TableCell>
                              <TableCell>
                                  <Badge variant={getPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{formatDate(task.due_date, 'PP')}</TableCell>
                          </TableRow>
                      ))
                      ) : (
                          <TableRow>
                              <TableCell colSpan={4} className="text-center h-24">No tasks found.</TableCell>
                          </TableRow>
                      )}
                  </TableBody>
                  </Table>
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}
