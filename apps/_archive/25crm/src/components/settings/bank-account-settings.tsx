'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@relentify/ui';
import { Button } from '@relentify/ui';
import { useApiCollection, apiDelete } from '@/hooks/use-api';
import { Skeleton } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { useToast } from '@/hooks/use-toast';
import { AddBankAccountDialog } from '../add-bank-account-dialog';

interface BankAccount {
    id: string;
    bank_name: string;
    account_name: string;
    account_number: string;
    sort_code: string;
    is_default: boolean;
}

export function BankAccountSettings() {
    const { toast } = useToast();
    const [accountToDelete, setAccountToDelete] = React.useState<BankAccount | null>(null);

    const { data: accounts, isLoading: loadingAccounts } = useApiCollection<BankAccount>('/api/bank-accounts');
    const { data: contacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');
    const contactMap = React.useMemo(() => new Map(contacts?.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]) || []), [contacts]);

    const handleDelete = async () => {
        if (!accountToDelete) return;

        try {
            await apiDelete(`/api/bank-accounts/${accountToDelete.id}`);
            toast({
                title: 'Bank Account Unlinked',
                description: `The account has been successfully unlinked.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to delete bank account.',
            });
        }
        setAccountToDelete(null);
    }

    const getStatusBadgeVariant = (isDefault: boolean) => {
        return isDefault ? 'default' : 'outline';
    }

    const isLoading = loadingAccounts || loadingContacts;

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Bank Accounts</CardTitle>
                        <CardDescription>
                            Manage bank accounts linked for payouts and payments.
                        </CardDescription>
                    </div>
                    <AddBankAccountDialog />
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bank</TableHead>
                                    <TableHead>Account Details</TableHead>
                                    <TableHead>Linked To</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : accounts && accounts.length > 0 ? (
                                    accounts.map((account) => (
                                        <TableRow key={account.id}>
                                            <TableCell className="font-medium">{account.bank_name}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{account.account_name}</div>
                                                <div className="text-sm text-muted-foreground">{account.sort_code} &middot; **** {account.account_number}</div>
                                            </TableCell>
                                            <TableCell>{contactMap.get((account as any).contactId) || 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(account.is_default)}>{account.is_default ? 'Default' : 'Active'}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setAccountToDelete(account)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No bank accounts linked yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently unlink this bank account from your system.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={handleDelete}
                    >
                        Unlink Account
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
