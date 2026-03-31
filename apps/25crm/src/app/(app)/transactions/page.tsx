'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@relentify/ui";
import { useApiCollection, apiUpdate } from '@/hooks/use-api';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from '@relentify/ui';
import { Badge } from '@relentify/ui';
import Link from 'next/link';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { Switch } from '@relentify/ui';
import { useToast } from '@/hooks/use-toast';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Button } from '@relentify/ui';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    currency: string;
    transaction_date: any;
    description: string;
    related_property_id?: string;
    tenancy_id?: string;
    payer_contact_id?: string;
    payee_contact_id?: string;
    reconciled?: boolean;
    property_address?: string;
    payer_name?: string;
    payee_name?: string;
    // Mapped fields for edit dialog compatibility
    transactionType?: string;
    transactionDate?: any;
    payerContactId?: string;
    payeeContactId?: string;
    relatedPropertyId?: string;
    relatedTenancyId?: string;
}

type SortDirection = 'asc' | 'desc';
type SortableColumns = 'transactionDate' | 'transactionType' | 'description' | 'amount';

export default function TransactionsPage() {
  const { toast } = useToast();
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortDescriptor, setSortDescriptor] = useState<{ column: SortableColumns; direction: SortDirection }>({ column: 'transactionDate', direction: 'desc' });

  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser, isAdmin } = useUserProfile();
  const organizationId = currentUserProfile?.organizationId;

  const { data: transactions, isLoading: loadingTransactions } = useApiCollection<Transaction>('/api/transactions');
  const { data: contacts, isLoading: loadingContacts } = useApiCollection<any>('/api/contacts');
  const { data: properties, isLoading: loadingProperties } = useApiCollection<any>('/api/properties');

  const contactMap = useMemo(() => {
    if (!contacts) return new Map<string, string>();
    return new Map(contacts.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]));
  }, [contacts]);

  const propertyMap = useMemo(() => {
    if (!properties) return new Map<string, string>();
    return new Map(properties.map((p: any) => [p.id, p.address_line1]));
  }, [properties]);

  const handleSort = (column: SortableColumns) => {
    if (sortDescriptor.column === column) {
      setSortDescriptor({ ...sortDescriptor, direction: sortDescriptor.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortDescriptor({ column, direction: 'asc' });
    }
  };

  const getDateValue = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return new Date();
  };

  const filteredAndSortedTransactions = useMemo(() => {
    if (!transactions) return [];
    let processedTransactions = transactions.filter(t => {
      const typeMatch = typeFilter === 'all' || t.type === typeFilter;
      const propertyMatch = propertyFilter === 'all' || t.related_property_id === propertyFilter;
      const statusMatch = statusFilter === 'all' || (statusFilter === 'reconciled' && t.reconciled) || (statusFilter === 'unreconciled' && !t.reconciled);
      return typeMatch && propertyMatch && statusMatch;
    });

    processedTransactions.sort((a, b) => {
        const { column, direction } = sortDescriptor;
        let aValue: any, bValue: any;

        switch(column) {
            case 'transactionDate':
                aValue = getDateValue(a.transaction_date).getTime();
                bValue = getDateValue(b.transaction_date).getTime();
                break;
            case 'transactionType':
                aValue = a.type;
                bValue = b.type;
                break;
            case 'description':
                aValue = a.description;
                bValue = b.description;
                break;
            case 'amount':
                aValue = a.amount;
                bValue = b.amount;
                break;
        }

        let comparison = 0;
        if (aValue > bValue) comparison = 1;
        else if (aValue < bValue) comparison = -1;

        return direction === 'desc' ? comparison * -1 : comparison;
    });

    return processedTransactions;

  }, [transactions, typeFilter, propertyFilter, statusFilter, sortDescriptor]);

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'Rent Payment': return 'default';
      case 'Management Fee':
      case 'Commission':
        return 'secondary';
      case 'Landlord Payout': return 'outline';
      case 'Contractor Payment':
      case 'Agency Expense':
        return 'destructive';
      case 'Deposit': return 'secondary';
      default: return 'secondary';
    }
  }

  const handleReconcileToggle = async (transaction: Transaction, reconciled: boolean) => {
    try {
      await apiUpdate(`/api/transactions/${transaction.id}`, { reconciled });
      toast({
          title: 'Transaction Updated',
          description: `Status changed to ${reconciled ? 'Reconciled' : 'Unreconciled'}.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update reconciliation status.' });
    }
  }

  const handleEditClick = (transaction: Transaction) => {
    // Map API field names to form field names for the edit dialog
    setEditingTransaction({
      id: transaction.id,
      transactionType: transaction.type,
      amount: transaction.amount,
      transactionDate: transaction.transaction_date,
      description: transaction.description,
      payerContactId: transaction.payer_contact_id || '',
      payeeContactId: transaction.payee_contact_id || '',
      relatedPropertyId: transaction.related_property_id || '',
      relatedTenancyId: transaction.tenancy_id || '',
      reconciled: transaction.reconciled,
    });
  };

  const handleExport = () => {
    if (!filteredAndSortedTransactions || filteredAndSortedTransactions.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no transactions in the current view to export.",
      });
      return;
    }

    const headers = [
      "Date", "Type", "Description", "Property", "From", "To", "Status", "Amount", "Currency"
    ];

    const csvRows = [headers.join(',')];

    for (const transaction of filteredAndSortedTransactions) {
      const row = [
        format(getDateValue(transaction.transaction_date), 'yyyy-MM-dd'),
        `"${transaction.type || ''}"`,
        `"${(transaction.description || '').replace(/"/g, '""')}"`,
        `"${transaction.related_property_id ? (transaction.property_address || propertyMap.get(transaction.related_property_id) || '') : ''}"`,
        `"${transaction.payer_contact_id ? (transaction.payer_name || contactMap.get(transaction.payer_contact_id) || '') : ''}"`,
        `"${transaction.payee_contact_id ? (transaction.payee_name || contactMap.get(transaction.payee_contact_id) || '') : ''}"`,
        transaction.reconciled ? 'Reconciled' : 'Unreconciled',
        transaction.amount,
        transaction.currency,
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: "Your transactions have been downloaded as a CSV file.",
    });
  };

  const isLoading = loadingTransactions || loadingContacts || loadingCurrentUser || loadingProperties;

  const EmptyState = () => (
    <Card className="col-span-full">
        <CardContent className="py-10 text-center">
            <h3 className="mt-2 text-xl font-semibold">No transactions found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Get started by adding a new transaction.
            </p>
            <div className="mt-6">
                <AddTransactionDialog />
            </div>
        </CardContent>
    </Card>
  );

  return (
    <>
      {editingTransaction && (
        <EditTransactionDialog
            transaction={editingTransaction}
            open={!!editingTransaction}
            onOpenChange={(isOpen) => !isOpen && setEditingTransaction(null)}
            isAdmin={isAdmin}
        />
      )}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter} disabled={isLoading}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="Filter by type..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {['Rent Payment', 'Management Fee', 'Commission', 'Landlord Payout', 'Contractor Payment', 'Agency Expense', 'Deposit'].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={propertyFilter} onValueChange={setPropertyFilter} disabled={isLoading}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="Filter by property..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.address_line1}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="Filter by status..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="reconciled">Reconciled</SelectItem>
                    <SelectItem value="unreconciled">Unreconciled</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline" size="sm" className="h-8 gap-1">
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Export
                </span>
            </Button>
            <AddTransactionDialog />
          </div>
        </div>
        {isLoading ? <Skeleton className="h-[400px] w-full" /> : !transactions || transactions.length === 0 ? <EmptyState /> : (
            <Card>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <SortableTableHead column="transactionDate" title="Date" sortDescriptor={sortDescriptor} onSort={handleSort} />
                    <SortableTableHead column="transactionType" title="Type" sortDescriptor={sortDescriptor} onSort={handleSort} />
                    <SortableTableHead column="description" title="Description" sortDescriptor={sortDescriptor} onSort={handleSort} />
                    <TableHead className="hidden md:table-cell">Property</TableHead>
                    <TableHead className="hidden lg:table-cell">From</TableHead>
                    <TableHead className="hidden lg:table-cell">To</TableHead>
                    <TableHead>Status</TableHead>
                    <SortableTableHead column="amount" title="Amount" sortDescriptor={sortDescriptor} onSort={handleSort} className="text-right" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAndSortedTransactions && filteredAndSortedTransactions.length > 0 ? (
                    filteredAndSortedTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="cursor-pointer" onClick={() => handleEditClick(transaction)}>
                        <TableCell className="text-sm text-muted-foreground">
                            {format(getDateValue(transaction.transaction_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                            <Badge variant={getBadgeVariant(transaction.type)}>{transaction.type}</Badge>
                        </TableCell>
                        <TableCell>
                            <p className="font-medium truncate max-w-xs">{transaction.description}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                            {transaction.related_property_id && (transaction.property_address || propertyMap.has(transaction.related_property_id)) ? (
                                <Link href={`/properties/${transaction.related_property_id}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>
                                    {transaction.property_address || propertyMap.get(transaction.related_property_id)}
                                </Link>
                            ) : <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                            {transaction.payer_contact_id && (transaction.payer_name || contactMap.has(transaction.payer_contact_id)) ? (
                                <Link href={`/contacts/${transaction.payer_contact_id}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>
                                    {transaction.payer_name || contactMap.get(transaction.payer_contact_id)}
                                </Link>
                            ) : <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                            {transaction.payee_contact_id && (transaction.payee_name || contactMap.has(transaction.payee_contact_id)) ? (
                                <Link href={`/contacts/${transaction.payee_contact_id}`} className="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>
                                    {transaction.payee_name || contactMap.get(transaction.payee_contact_id)}
                                </Link>
                            ) : <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell>
                            <Switch
                                checked={!!transaction.reconciled}
                                onCheckedChange={(checked) => handleReconcileToggle(transaction, checked)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Toggle reconciled status"
                            />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                            {formatCurrency(transaction.amount, transaction.currency)}
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center h-24">
                        No transactions found.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </CardContent>
            </Card>
        )}
      </div>
    </>
  );
}
