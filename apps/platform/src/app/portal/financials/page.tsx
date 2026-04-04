'use client'

import React, { useState, useMemo } from 'react'
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile'
import { useApiCollection } from '@/hooks/use-api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@relentify/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@relentify/ui'
import { Skeleton } from '@relentify/ui'
import { Badge } from '@relentify/ui'
import { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/crm/date-range-picker'
import { format, startOfYear } from 'date-fns'

export default function PortalFinancialsPage() {
  const { portalUserProfile, isLoading: isLoadingProfile } =
    usePortalUserProfile()
  const contactId = portalUserProfile?.contact_id

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: new Date(),
  })

  const { data: properties, isLoading: isLoadingProperties } =
    useApiCollection('/api/properties')
  const { data: allTransactions, isLoading: isLoadingTransactions } =
    useApiCollection('/api/transactions')

  // Filter properties owned by this landlord
  const landlordProperties = useMemo(
    () =>
      contactId
        ? properties?.filter((p: any) =>
            p.landlord_ids?.includes(contactId)
          ) || []
        : [],
    [properties, contactId]
  )

  const propertyIds = useMemo(
    () => landlordProperties.map((p: any) => p.id),
    [landlordProperties]
  )

  // Filter transactions by property and date range
  const transactions = useMemo(() => {
    if (propertyIds.length === 0 || !dateRange?.from || !dateRange?.to)
      return []
    return (
      allTransactions?.filter((t: any) => {
        if (!propertyIds.includes(t.property_id)) return false
        const txDate = new Date(t.transaction_date || t.created_at)
        return txDate >= dateRange.from! && txDate <= dateRange.to!
      }) || []
    )
  }, [allTransactions, propertyIds, dateRange])

  const isLoading =
    isLoadingProfile || isLoadingProperties || isLoadingTransactions

  const formatCurrency = (amount: number, currency = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
      amount
    )

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'Rent Payment':
        return 'default'
      case 'Management Fee':
      case 'Commission':
        return 'secondary'
      case 'Landlord Payout':
        return 'outline'
      case 'Contractor Payment':
      case 'Agency Expense':
        return 'destructive'
      case 'Deposit':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Financials</h1>
        <p className="text-muted-foreground">
          View transactions related to your properties.
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <DateRangePicker date={dateRange} setDate={setDateRange} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(
                        new Date(t.transaction_date || t.created_at),
                        'PP'
                      )}
                    </TableCell>
                    <TableCell>
                      {landlordProperties.find(
                        (p: any) => p.id === t.property_id
                      )?.address_line_1 ||
                        landlordProperties.find(
                          (p: any) => p.id === t.property_id
                        )?.address}
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(t.transaction_type)}>
                        {t.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(t.amount || 0))}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No transactions found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
