'use client';

import React from 'react';
import { collection, query, doc } from 'firebase/firestore';
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
import { useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import { useToast } from '@/hooks/use-toast';
import { AddBankAccountDialog } from '../add-bank-account-dialog';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface BankAccount {
    id: string;
    bankName: string;
    accountName: string;
    accountNumberMask: string;
    sortCode: string;
    status: 'Active' | 'Disconnected' | 'Error';
    contactId: string;
}

export function BankAccountSettings() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const auth = useAuth();
    const [accountToDelete, setAccountToDelete] = React.useState<BankAccount | null>(null);
    const { userProfile: currentUserProfile, isLoading: isCurrentUserLoading } = useUserProfile();
    const organizationId = currentUserProfile?.organizationId;

    const accountsQuery = useMemoFirebase(() =>
        (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/bankAccounts`) : null,
        [firestore, organizationId]
    );
    const { data: accounts, isLoading: loadingAccounts } = useCollection<BankAccount>(accountsQuery);

    const contactsQuery = useMemoFirebase(() =>
        (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null,
        [firestore, organizationId]
    );
    const { data: contacts, isLoading: loadingContacts } = useCollection<any>(contactsQuery);
    const contactMap = React.useMemo(() => new Map(contacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [contacts]);

    const handleDelete = () => {
        if (!firestore || !auth || !organizationId || !accountToDelete) return;

        const docRef = doc(firestore, `organizations/${organizationId}/bankAccounts`, accountToDelete.id);
        const entityName = `${accountToDelete.bankName} (${accountToDelete.accountNumberMask})`;
        deleteDocumentNonBlocking(firestore, auth, organizationId, docRef, entityName);

        toast({
            title: 'Bank Account Unlinked',
            description: `The account has been successfully unlinked.`,
        });
        setAccountToDelete(null);
    }

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'Active': return 'default';
            case 'Disconnected': return 'outline';
            case 'Error': return 'destructive';
            default: return 'secondary';
        }
    }

    const isLoading = isCurrentUserLoading || loadingAccounts || loadingContacts;
    
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
                                            <TableCell className="font-medium">{account.bankName}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{account.accountName}</div>
                                                <div className="text-sm text-muted-foreground">{account.sortCode} &middot; **** {account.accountNumberMask}</div>
                                            </TableCell>
                                            <TableCell>{contactMap.get(account.contactId) || 'Unknown Contact'}</TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(account.status)}>{account.status}</Badge></TableCell>
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
