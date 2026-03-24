'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { LayoutGrid, List, User, Flag, PlusCircle, Mail, Home, FileText } from "lucide-react";
import { collection, Timestamp, query } from 'firebase/firestore';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Avatar, AvatarFallback } from '@relentify/ui';
import { AddTaskDialog } from '@/components/add-task-dialog';
import { Badge } from '@relentify/ui';
import { EditTaskDialog } from '@/components/edit-task-dialog';
import { SortableTableHead } from '@/components/sortable-table-head';

type TaskStatus = 'Open' | 'In Progress' | 'Completed';
type SortDirection = 'asc' | 'desc';
type SortableColumns = 'title' | 'dueDate' | 'assignedToUserId' | 'priority';

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: any;
  assignedToUserId: string;
  priority: 'High' | 'Medium' | 'Low';
  status: TaskStatus;
  relatedCommunicationId?: string;
  relatedPropertyId?: string;
  relatedContactId?: string;
  relatedTenancyId?: string;
}

const statusColumns: TaskStatus[] = ['Open', 'In Progress', 'Completed'];

const priorityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export default function TasksPage() {
  const firestore = useFirestore();
  
  // State for filters, sorting, and dialogs
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortDescriptor, setSortDescriptor] = useState<{ column: SortableColumns; direction: SortDirection }>({ column: 'dueDate', direction: 'asc' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  // Set the filter to the current user by default once their profile is loaded
  useEffect(() => {
    if (currentUserProfile?.id) {
        setAssigneeFilter(currentUserProfile.id);
    }
  }, [currentUserProfile?.id]);

  // Fetch tasks, only after we know the current user's organization
  const tasksQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/tasks`) : null,
    [firestore, organizationId]
  );
  const { data: tasks, isLoading: loadingTasks } = useCollection<Task>(tasksQuery);
  
  // Fetch all user profiles to map assignedToUserId to a name
  const usersQuery = useMemoFirebase(() =>
    (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/userProfiles`) : null,
    [firestore, organizationId]
  );
  const { data: users, isLoading: loadingUsers } = useCollection<any>(usersQuery);

  // Create a sorted list of users for the filter, putting "My Tasks" first
  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a, b) => {
        if (a.id === currentUserProfile?.id) return -1;
        if (b.id === currentUserProfile?.id) return 1;
        if (a.firstName && b.firstName) {
            return a.firstName.localeCompare(b.firstName);
        }
        return 0;
    });
  }, [users, currentUserProfile?.id]);

  // Create a map of userId -> {firstName, lastName} once users are loaded
  const userMap = useMemo(() => {
    if (!users) return new Map<string, { firstName: string, lastName: string }>();
    return new Map(users.map(u => [u.id, { firstName: u.firstName, lastName: u.lastName }]));
  }, [users]);
  
  function getAssigneeName(userId: string): string {
    const user = userMap.get(userId);
    if (!user) return 'Unassigned';
    return `${user.firstName} ${user.lastName}`;
  }

  const filteredAndSortedTasks = useMemo(() => {
    let processedTasks = tasks || [];

    // Apply filters
    if (assigneeFilter !== 'all') {
      processedTasks = processedTasks.filter(task => task.assignedToUserId === assigneeFilter);
    }
    if (priorityFilter !== 'all') {
      processedTasks = processedTasks.filter(task => task.priority === priorityFilter);
    }

    // Apply sorting
    processedTasks.sort((a, b) => {
      const { column, direction } = sortDescriptor;
      let aValue: any, bValue: any;

      switch(column) {
        case 'assignedToUserId':
            aValue = getAssigneeName(a.assignedToUserId);
            bValue = getAssigneeName(b.assignedToUserId);
            break;
        case 'dueDate':
            aValue = getTimestampAsDate(a.dueDate).getTime();
            bValue = getTimestampAsDate(b.dueDate).getTime();
            break;
        case 'priority':
            aValue = priorityOrder[a.priority] || 0;
            bValue = priorityOrder[b.priority] || 0;
            break;
        default:
            aValue = a[column];
            bValue = b[column];
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
  }, [tasks, assigneeFilter, priorityFilter, sortDescriptor, userMap]);
  
  const tasksByStatus = useMemo(() => {
    const initial: Record<TaskStatus, Task[]> = { 'Open': [], 'In Progress': [], 'Completed': [] };
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
        case 'Open': return 'secondary';
        case 'In Progress': return 'default';
        case 'Completed': return 'outline';
        default: return 'secondary';
    }
  }

  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    return new Date();
  };
  
  const getAssigneeInitials = (userId: string) => {
    const user = userMap.get(userId);
    if (!user) return '??';
    return `${user.firstName?.substring(0,1) || ''}${user.lastName?.substring(0,1) || ''}`
  }

  const isLoading = loadingTasks || loadingUsers || loadingCurrentUser;

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
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter} disabled={isLoading}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by assignee..." />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {sortedUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                          {user.id === currentUserProfile?.id ? 'My Tasks' : `${user.firstName} ${user.lastName}`}
                      </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
                                            {task.relatedCommunicationId && (
                                              <Tooltip><TooltipTrigger><Mail className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Email</p></TooltipContent></Tooltip>
                                            )}
                                            {task.relatedPropertyId && (
                                              <Tooltip><TooltipTrigger><Home className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Property</p></TooltipContent></Tooltip>
                                            )}
                                            {task.relatedContactId && (
                                              <Tooltip><TooltipTrigger><User className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Contact</p></TooltipContent></Tooltip>
                                            )}
                                            {task.relatedTenancyId && (
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
                                      <span>Due: {format(getTimestampAsDate(task.dueDate), 'MMM d')}</span>
                                      <div className="flex items-center gap-2" title={getAssigneeName(task.assignedToUserId)}>
                                          <Avatar className="h-6 w-6"><AvatarFallback>{getAssigneeInitials(task.assignedToUserId)}</AvatarFallback></Avatar>
                                      </div>
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
                          <SortableTableHead column="dueDate" title="Due Date" sortDescriptor={sortDescriptor} onSort={handleSort} />
                          <SortableTableHead column="assignedToUserId" title="Assignee" sortDescriptor={sortDescriptor} onSort={handleSort} />
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
                                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
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
                                            {task.relatedCommunicationId && (
                                              <Tooltip><TooltipTrigger><Mail className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Email</p></TooltipContent></Tooltip>
                                            )}
                                            {task.relatedPropertyId && (
                                              <Tooltip><TooltipTrigger><Home className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Property</p></TooltipContent></Tooltip>
                                            )}
                                            {task.relatedContactId && (
                                              <Tooltip><TooltipTrigger><User className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Linked to Contact</p></TooltipContent></Tooltip>
                                            )}
                                            {task.relatedTenancyId && (
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
                              <TableCell className="text-sm">{format(getTimestampAsDate(task.dueDate), 'PP')}</TableCell>
                              <TableCell>
                                  <div className="flex items-center gap-2" title={getAssigneeName(task.assignedToUserId)}>
                                      <Avatar className="h-7 w-7 text-xs"><AvatarFallback>{getAssigneeInitials(task.assignedToUserId)}</AvatarFallback></Avatar>
                                      <span className="text-sm">{getAssigneeName(task.assignedToUserId)}</span>
                                  </div>
                              </TableCell>
                          </TableRow>
                      ))
                      ) : (
                          <TableRow>
                              <TableCell colSpan={5} className="text-center h-24">No tasks found.</TableCell>
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
