'use client';

import React, { useState } from 'react';
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
import { useApiCollection, apiUpdate } from '@/hooks/use-api';
import { Skeleton } from '@relentify/ui';
import { AddWorkflowRuleDialog } from '@/components/add-workflow-rule-dialog';
import { Badge } from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Bot, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function ManualWorkflows() {
    const [isCheckingTenancies, setIsCheckingTenancies] = useState(false);
    const [isCheckingArrears, setIsCheckingArrears] = useState(false);
    const { toast } = useToast();

    const handleCheckTenancies = async () => {
        setIsCheckingTenancies(true);
        try {
            // Fetch active tenancies, tasks, and properties via API
            const [tenanciesRes, tasksRes, propertiesRes] = await Promise.all([
                fetch('/api/tenancies'),
                fetch('/api/tasks'),
                fetch('/api/properties'),
            ]);
            const tenancies = await tenanciesRes.json();
            const tasks = await tasksRes.json();
            const properties = await propertiesRes.json();

            const propertyMap = new Map(properties.map((p: any) => [p.id, p.address_line1 || p.address]));

            const sixtyDaysFromNow = new Date();
            sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
            const now = new Date();

            const expiringTenancies = tenancies.filter((t: any) => {
                if (t.status !== 'Active') return false;
                const endDate = new Date(t.end_date);
                return endDate >= now && endDate <= sixtyDaysFromNow;
            });

            if (expiringTenancies.length === 0) {
                toast({ title: "No Action Needed", description: "No active tenancies are expiring within 60 days." });
                setIsCheckingTenancies(false);
                return;
            }

            let tasksCreated = 0;

            for (const tenancy of expiringTenancies) {
                const renewalTaskExists = tasks.some((task: any) =>
                    task.related_tenancy_id === tenancy.id && task.title?.startsWith('Follow up on tenancy renewal')
                );

                if (!renewalTaskExists) {
                    const propertyAddress = propertyMap.get(tenancy.property_id) || 'Unknown Property';
                    const endDate = new Date(tenancy.end_date);
                    await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: `Follow up on tenancy renewal for ${propertyAddress}`,
                            description: `This tenancy is due to expire on ${endDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}. Contact the tenants and landlord to discuss renewal.`,
                            due_date: tenancy.end_date,
                            priority: 'Medium',
                            status: 'Open',
                            related_tenancy_id: tenancy.id,
                            related_property_id: tenancy.property_id,
                        }),
                    });
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
        setIsCheckingArrears(true);
        try {
            const gracePeriodDay = 5;
            if (new Date().getDate() <= gracePeriodDay) {
                toast({ title: "Too Early to Check", description: `Rent is not considered late until after day ${gracePeriodDay} of the month.` });
                setIsCheckingArrears(false);
                return;
            }

            const [tenanciesRes, transactionsRes, propertiesRes] = await Promise.all([
                fetch('/api/tenancies'),
                fetch('/api/transactions?type=Rent Payment'),
                fetch('/api/properties'),
            ]);
            const tenancies = await tenanciesRes.json();
            const transactions = await transactionsRes.json();
            const properties = await propertiesRes.json();

            const propertyMap = new Map(properties.map((p: any) => [p.id, p.address_line1 || p.address]));

            const activeTenancies = tenancies.filter((t: any) => t.status === 'Active');

            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const rentPaymentsThisMonth = transactions.filter((t: any) =>
                new Date(t.transaction_date) >= startOfMonth
            );

            let tenanciesUpdated = 0;

            for (const tenancy of activeTenancies) {
                const hasPaid = rentPaymentsThisMonth.some((p: any) =>
                    p.related_tenancy_id === tenancy.id && parseFloat(p.amount) >= parseFloat(tenancy.rent_amount)
                );

                if (!hasPaid) {
                    await fetch(`/api/tenancies/${tenancy.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'Arrears' }),
                    });
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
    const { toast } = useToast();
    const { data: workflows, isLoading: loadingWorkflows } = useApiCollection<any>('/api/workflow-rules');

    const handleToggleActive = async (rule: any) => {
        try {
            await apiUpdate(`/api/workflow-rules/${rule.id}`, { is_active: !rule.is_active });
            toast({
                title: rule.is_active ? 'Rule Deactivated' : 'Rule Activated',
                description: `"${rule.name}" has been ${rule.is_active ? 'deactivated' : 'activated'}.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to update rule.',
            });
        }
    };

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
                {loadingWorkflows ? (
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
                                    workflows.map((rule: any) => (
                                        <TableRow key={rule.id}>
                                            <TableCell>
                                                <div className="font-medium">{rule.name}</div>
                                                <div className="text-sm text-muted-foreground line-clamp-1">{rule.description}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="zinc">{rule.trigger_type}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={rule.is_active ? 'default' : 'outline'}
                                                    className="cursor-pointer"
                                                    onClick={() => handleToggleActive(rule)}
                                                >
                                                    {rule.is_active ? 'Active' : 'Inactive'}
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
