'use client'

import React, { useMemo, useState } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@relentify/ui'
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile'
import { useApiCollection } from '@/hooks/use-api'
import { Skeleton } from '@relentify/ui'
import { Badge } from '@relentify/ui'
import {
  Home,
  FileText,
  Bed,
  Bath,
  PoundSterling,
  Wrench,
  Landmark,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@relentify/ui'
import { format, subDays, startOfYear } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@relentify/ui'

// Component for Tenant Dashboard
const TenantDashboard = ({ contactId }: { contactId: string }) => {
  const { data: tenancies, isLoading: isLoadingTenancies } =
    useApiCollection('/api/tenancies')
  const { data: properties, isLoading: isLoadingProperties } =
    useApiCollection('/api/properties')

  const activeTenancy = tenancies?.find(
    (t: any) =>
      t.status === 'Active' && t.tenant_ids?.includes(contactId)
  )

  const property = properties?.find(
    (p: any) => p.id === activeTenancy?.property_id
  )

  const isLoading = isLoadingTenancies || isLoadingProperties

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!activeTenancy) {
    return (
      <Card>
        <CardContent className="p-6">
          You do not have an active tenancy.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" /> Your Rented Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          {property ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                {property.address_line_1 || property.address}
              </h3>
              <p className="text-muted-foreground">
                {property.city}, {property.postcode}
              </p>
              <div className="flex flex-wrap gap-4 text-sm pt-2">
                <div className="flex items-center gap-2">
                  <Bed className="h-4 w-4" /> {property.bedrooms} Bedrooms
                </div>
                <div className="flex items-center gap-2">
                  <Bath className="h-4 w-4" /> {property.bathrooms} Bathrooms
                </div>
                <div className="flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />{' '}
                  {Number(property.rent_amount || 0).toLocaleString()} / month
                </div>
              </div>
            </div>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Your Tenancy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{activeTenancy.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Term</p>
              <p className="font-medium">
                {activeTenancy.start_date
                  ? new Date(activeTenancy.start_date).toLocaleDateString()
                  : 'N/A'}{' '}
                -{' '}
                {activeTenancy.end_date
                  ? new Date(activeTenancy.end_date).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Component for Landlord Dashboard
const LandlordDashboard = ({ contactId }: { contactId: string }) => {
  const [timeRange, setTimeRange] = useState('30')

  const { data: properties, isLoading: isLoadingProperties } =
    useApiCollection('/api/properties')
  const { data: allMaintenance, isLoading: isLoadingMaintenance } =
    useApiCollection('/api/maintenance')
  const { data: allTransactions, isLoading: isLoadingTransactions } =
    useApiCollection('/api/transactions')

  // Filter properties owned by this landlord
  const landlordProperties = useMemo(
    () =>
      properties?.filter((p: any) =>
        p.landlord_ids?.includes(contactId)
      ) || [],
    [properties, contactId]
  )

  const propertyIds = useMemo(
    () => landlordProperties.map((p: any) => p.id),
    [landlordProperties]
  )

  // Filter maintenance for landlord's properties
  const maintenanceRequests = useMemo(
    () =>
      allMaintenance?.filter(
        (m: any) =>
          propertyIds.includes(m.property_id) &&
          ['New', 'In Progress', 'Awaiting Parts', 'On Hold'].includes(
            m.status
          )
      ) || [],
    [allMaintenance, propertyIds]
  )

  // Filter transactions by date range
  const dateFrom = useMemo(() => {
    if (timeRange === 'ytd') return startOfYear(new Date())
    return subDays(new Date(), parseInt(timeRange))
  }, [timeRange])

  const transactions = useMemo(
    () =>
      allTransactions?.filter((t: any) => {
        if (!propertyIds.includes(t.property_id)) return false
        const txDate = new Date(t.transaction_date || t.created_at)
        return txDate >= dateFrom
      }) || [],
    [allTransactions, propertyIds, dateFrom]
  )

  const financialSummary = useMemo(() => {
    const income = transactions
      .filter((t: any) => t.transaction_type === 'Rent Payment')
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
    const expenses = transactions
      .filter((t: any) =>
        ['Management Fee', 'Contractor Payment'].includes(t.transaction_type)
      )
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
    return { income, expenses, net: income - expenses }
  }, [transactions])

  const formatCurrency = (amount: number, currency = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
      amount
    )

  const isLoading =
    isLoadingProperties || isLoadingMaintenance || isLoadingTransactions

  const timeRangeLabel = useMemo(() => {
    if (timeRange === 'ytd') return 'this year'
    return `the last ${timeRange} days`
  }, [timeRange])

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" /> Financials
              </CardTitle>
              <CardDescription>
                A summary of financial activity for {timeRangeLabel}.
              </CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="ytd">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Income</p>
                <p className="text-xl font-bold text-[var(--theme-success)]">
                  {formatCurrency(financialSummary.income)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-xl font-bold text-[var(--theme-destructive)]">
                  {formatCurrency(financialSummary.expenses)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net</p>
                <p className="text-xl font-bold">
                  {formatCurrency(financialSummary.net)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Open Maintenance Requests
          </CardTitle>
          <CardDescription>
            Active maintenance issues across your properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceRequests.length > 0 ? (
                  maintenanceRequests.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        {landlordProperties.find(
                          (p: any) => p.id === req.property_id
                        )?.address_line_1 ||
                          landlordProperties.find(
                            (p: any) => p.id === req.property_id
                          )?.address}
                      </TableCell>
                      <TableCell className="truncate max-w-xs">
                        {req.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="zinc">{req.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">
                      No open maintenance requests.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" /> Your Properties
          </CardTitle>
          <CardDescription>
            You have {landlordProperties.length} properties in your portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProperties ? (
            <Skeleton className="h-20 w-full" />
          ) : landlordProperties.length > 0 ? (
            <div className="space-y-4">
              {landlordProperties.map((prop: any) => (
                <div key={prop.id} className="block border p-4 rounded-lg">
                  <p className="font-semibold">
                    {prop.address_line_1 || prop.address}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {prop.city}, {prop.postcode}
                  </p>
                  <Badge
                    variant={
                      prop.status === 'Available' ? 'default' : 'secondary'
                    }
                    className="mt-2"
                  >
                    {prop.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p>You do not have any properties assigned to you.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function PortalDashboardPage() {
  const { portalUserProfile, isLoading: isLoadingProfile } =
    usePortalUserProfile()

  if (isLoadingProfile) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-4xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/5" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const firstName = portalUserProfile?.full_name?.split(' ')[0] || 'User'

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Welcome, {firstName}</h1>
        <p className="text-muted-foreground">
          This is your dedicated dashboard.
        </p>
      </div>

      {portalUserProfile?.role === 'Tenant' &&
        portalUserProfile.contact_id && (
          <TenantDashboard contactId={portalUserProfile.contact_id} />
        )}

      {portalUserProfile?.role === 'Landlord' &&
        portalUserProfile.contact_id && (
          <LandlordDashboard contactId={portalUserProfile.contact_id} />
        )}

      {portalUserProfile &&
        portalUserProfile.role !== 'Tenant' &&
        portalUserProfile.role !== 'Landlord' && (
          <Card>
            <CardHeader>
              <CardTitle>Portal Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Your account type ({portalUserProfile.role}) does not currently
                have a dedicated portal dashboard.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
