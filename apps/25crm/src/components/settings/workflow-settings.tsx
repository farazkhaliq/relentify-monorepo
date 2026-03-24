'use client';

import React, { useState } from 'react';
import { collection, query, where, getDocs, Timestamp, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
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
import { useCollection, useFirestore, useMemoFirebase, useAuth, logAuditEvent } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { AddWorkflowRuleDialog } from '@/components/add-workflow-rule-dialog';
import { Badge } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Bot, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addDays, format, startOfMonth } from 'date-fns';

function ManualWorkflows() {
    const [isCheckingTenancies, setIsCheckingTenancies] = useState(false);
    const [isCheckingArrears, setIsCheckingArrears] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const auth = useAuth();
    const { userProfile } = useUserProfile();
    const organizationId = userProfile?.organizationId;

    const handleCheckTenancies = async () => {
        if (!firestore || !organizationId || !auth.currentUser) {
            toast({ variant: "destructive", title: "Cannot run workflow", description: "User or organization not found." });
            return;
        }
        setIsCheckingTenancies(true);
        try {
            // 1. Get tenancies expiring in the next 60 days
            const sixtyDaysFromNow = Timestamp.fromDate(addDays(new Date(), 60));
            const now = Timestamp.fromDate(new Date());

            const tenanciesRef = collection(firestore, `organizations/${organizationId}/tenancies`);
            const expiringTenanciesQuery = query(
                tenanciesRef,
                where('status', '==', 'Active'),
                where('endDate', '<=', sixtyDaysFromNow),
                where('endDate', '>=', now)
            );
            const expiringTenanciesSnap = await getDocs(expiringTenanciesQuery);
            const expiringTenancies = expiringTenanciesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

            if (expiringTenancies.length === 0) {
                toast({ title: "No Action Needed", description: "No active tenancies are expiring within 60 days." });
                setIsCheckingTenancies(false);
                return;
            }
            
            // 2. Get all tasks and properties to avoid duplicates and get names
            const tasksRef = collection(firestore, `organizations/${organizationId}/tasks`);
            const tasksSnap = await getDocs(tasksRef);
            const allTasks = tasksSnap.docs.map(d => d.data());

            const propertiesRef = collection(firestore, `organizations/${organizationId}/properties`);
            const propertiesSnap = await getDocs(propertiesRef);
            const propertyMap = new Map(propertiesSnap.docs.map(d => [d.id, d.data().addressLine1]));

            const notificationsRef = collection(firestore, `organizations/${organizationId}/notifications`);

            let tasksCreated = 0;

            // 3. Loop and create tasks if needed
            for (const tenancy of expiringTenancies) {
                const renewalTaskExists = allTasks.some(task => 
                    task.relatedTenancyId === tenancy.id && task.title.startsWith('Follow up on tenancy renewal')
                );

                if (!renewalTaskExists && tenancy.createdByUserId) {
                    const propertyAddress = propertyMap.get(tenancy.propertyId) || 'Unknown Property';
                    const newTaskRef = doc(tasksRef);
                    const newTaskData = {
                        id: newTaskRef.id,
                        organizationId,
                        title: `Follow up on tenancy renewal for ${propertyAddress}`,
                        description: `This tenancy is due to expire on ${format(tenancy.endDate.toDate(), 'PP')}. Contact the tenants and landlord to discuss renewal.`,
                        assignedToUserId: tenancy.createdByUserId,
                        createdByUserId: auth.currentUser.uid,
                        dueDate: tenancy.endDate.toDate(),
                        priority: 'Medium',
                        status: 'Open',
                        relatedTenancyId: tenancy.id,
                        relatedPropertyId: tenancy.propertyId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };
                    
                    await setDoc(newTaskRef, newTaskData);
                    logAuditEvent(firestore, auth, organizationId, 'Created', newTaskRef, newTaskData.title, newTaskRef.id);

                    // Create notification for the assigned user
                    const newNotificationRef = doc(notificationsRef);
                    const newNotificationData = {
                        id: newNotificationRef.id,
                        organizationId,
                        userId: tenancy.createdByUserId,
                        title: "New Task: Tenancy Renewal",
                        message: `A task to follow up on the tenancy at ${propertyAddress} was created for you.`,
                        link: `/tasks`,
                        isRead: false,
                        createdAt: serverTimestamp(),
                    };
                    await setDoc(newNotificationRef, newNotificationData);
                    logAuditEvent(firestore, auth, organizationId, 'Created', newNotificationRef, newNotificationData.title, newNotificationRef.id);

                    tasksCreated++;
                }
            }

            if (tasksCreated > 0) {
                toast({ title: "Workflow Complete", description: `Created ${tasksCreated} new task(s) for expiring tenancies.` });
            } else {
                toast({ title: "Workflow Complete", description: "No new tasks were needed for expiring tenancies." });
            }

        } catch (error: any) {
            console.error("Workflow failed:", error);
            toast({ variant: "destructive", title: "Workflow Failed", description: error.message });
        } finally {
            setIsCheckingTenancies(false);
        }
    };

    const handleCheckArrears = async () => {
        if (!firestore || !organizationId || !auth.currentUser) {
            toast({ variant: "destructive", title: "Cannot run workflow", description: "User or organization not found." });
            return;
        }
        setIsCheckingArrears(true);
        try {
            const gracePeriodDay = 5;
            if (new Date().getDate() <= gracePeriodDay) {
                toast({ title: "Too Early to Check", description: `Rent is not considered late until after day ${gracePeriodDay} of the month.` });
                setIsCheckingArrears(false);
                return;
            }

            const tenanciesRef = collection(firestore, `organizations/${organizationId}/tenancies`);
            const qTenancies = query(tenanciesRef, where('status', '==', 'Active'));
            const tenanciesSnap = await getDocs(qTenancies);
            const activeTenancies = tenanciesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

            const startOfMonthDate = startOfMonth(new Date());
            const transactionsRef = collection(firestore, `organizations/${organizationId}/transactions`);
            const qTransactions = query(transactionsRef, where('transactionType', '==', 'Rent Payment'), where('transactionDate', '>=', startOfMonthDate));
            const transactionsSnap = await getDocs(qTransactions);
            const rentPaymentsThisMonth = transactionsSnap.docs.map(d => d.data());
            
            const propertiesRef = collection(firestore, `organizations/${organizationId}/properties`);
            const propertiesSnap = await getDocs(propertiesRef);
            const propertyMap = new Map(propertiesSnap.docs.map(d => [d.id, d.data().addressLine1]));

            const notificationsRef = collection(firestore, `organizations/${organizationId}/notifications`);
            let tenanciesUpdated = 0;

            for (const tenancy of activeTenancies) {
                const hasPaid = rentPaymentsThisMonth.some(p => p.relatedTenancyId === tenancy.id && p.amount >= tenancy.rentAmount);

                if (!hasPaid) {
                    const tenancyRef = doc(firestore, `organizations/${organizationId}/tenancies`, tenancy.id);
                    await updateDoc(tenancyRef, { status: 'Arrears', updatedAt: serverTimestamp() });
                    logAuditEvent(firestore, auth, organizationId, 'Updated', tenancyRef, `Tenancy at ${propertyMap.get(tenancy.propertyId)}`);
                    
                    if (tenancy.createdByUserId) {
                        const newNotificationRef = doc(notificationsRef);
                        const propertyAddress = propertyMap.get(tenancy.propertyId) || 'Unknown Property';
                        const newNotificationData = {
                            id: newNotificationRef.id,
                            organizationId,
                            userId: tenancy.createdByUserId,
                            title: "Rent Overdue",
                            message: `Rent for ${propertyAddress} is overdue. Tenancy marked as 'Arrears'.`,
                            link: `/tenancies/${tenancy.id}`,
                            isRead: false,
                            createdAt: serverTimestamp(),
                        };
                        await setDoc(newNotificationRef, newNotificationData);
                    }
                    tenanciesUpdated++;
                }
            }

            if (tenanciesUpdated > 0) {
                toast({ title: "Arrears Check Complete", description: `Updated ${tenanciesUpdated} tenancies to 'Arrears'.` });
            } else {
                toast({ title: "Arrears Check Complete", description: "All active tenancies are up to date with rent." });
            }

        } catch (error: any) {
            console.error("Arrears check failed:", error);
            toast({ variant: "destructive", title: "Workflow Failed", description: error.message });
        } finally {
            setIsCheckingArrears(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Triggers</CardTitle>
                <CardDescription>
                    Run workflow checks manually. These actions will scan your data and perform automated tasks based on your rules.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                        <h3 className="font-semibold">Check for Expiring Tenancies</h3>
                        <p className="text-sm text-muted-foreground">Creates follow-up tasks for tenancies expiring within 60 days.</p>
                    </div>
                    <Button onClick={handleCheckTenancies} disabled={isCheckingTenancies}>
                        <Bot className="mr-2 h-4 w-4" />
                        {isCheckingTenancies ? 'Checking...' : 'Run Check'}
                    </Button>
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                        <h3 className="font-semibold">Check for Overdue Rent</h3>
                        <p className="text-sm text-muted-foreground">Flags active tenancies as 'Arrears' if rent is not paid.</p>
                    </div>
                    <Button onClick={handleCheckArrears} disabled={isCheckingArrears}>
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        {isCheckingArrears ? 'Checking...' : 'Run Check'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function WorkflowSettings() {
    const firestore = useFirestore();
    const { userProfile: currentUserProfile, isLoading: isCurrentUserLoading } = useUserProfile();
    const organizationId = currentUserProfile?.organizationId;

    const workflowsQuery = useMemoFirebase(() =>
        (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/workflowRules`) : null,
        [firestore, organizationId]
    );
    const { data: workflows, isLoading: loadingWorkflows } = useCollection<any>(workflowsQuery);

    const isLoading = isCurrentUserLoading || loadingWorkflows;
    
    return (
        <>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Workflow Automation Rules</CardTitle>
                    <CardDescription>
                        Define rules to automate tasks and processes. The logic for these rules is not yet active.
                    </CardDescription>
                </div>
                <AddWorkflowRuleDialog />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rule</TableHead>
                                    <TableHead>Trigger Event</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {workflows && workflows.length > 0 ? (
                                    workflows.map((rule) => (
                                        <TableRow key={rule.id}>
                                            <TableCell>
                                                <div className="font-medium">{rule.name}</div>
                                                <div className="text-sm text-muted-foreground line-clamp-1">{rule.description}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="zinc">{rule.eventType}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={rule.isActive ? 'default' : 'outline'}>
                                                    {rule.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            No workflow rules created yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
        <ManualWorkflows />
        </>
    );
}
