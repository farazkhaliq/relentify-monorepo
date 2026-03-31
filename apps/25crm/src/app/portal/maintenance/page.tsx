'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { usePortalUserProfile } from '@/hooks/use-portal-user-profile'
import { useApiCollection } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@relentify/ui'
import { Skeleton } from '@relentify/ui'
import { Badge } from '@relentify/ui'
import { AddPortalMaintenanceRequestDialog } from '@/components/add-portal-maintenance-request-dialog'

export default function PortalMaintenancePage() {
  const { portalUserProfile, isLoading: isLoadingProfile } =
    usePortalUserProfile()
  const contactId = portalUserProfile?.contact_id

  const { data: allMaintenance, isLoading: isLoadingRequests } =
    useApiCollection('/api/maintenance')
  const { data: properties, isLoading: loadingProperties } =
    useApiCollection('/api/properties')

  // Filter to requests reported by this portal user
  const requests = React.useMemo(
    () =>
      contactId
        ? allMaintenance?.filter(
            (r: any) => r.reported_by_id === contactId
          ) || []
        : [],
    [allMaintenance, contactId]
  )

  const propertyMap = React.useMemo(
    () =>
      new Map(
        properties?.map((p: any) => [
          p.id,
          p.address_line_1 || p.address,
        ]) || []
      ),
    [properties]
  )

  const isLoading = isLoadingProfile || isLoadingRequests || loadingProperties

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'New':
        return 'default'
      case 'In Progress':
        return 'secondary'
      case 'Completed':
        return 'outline'
      case 'Cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'destructive'
      case 'High':
        return 'default'
      case 'Medium':
        return 'secondary'
      case 'Low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">
            Report new issues and view the status of existing requests.
          </p>
        </div>
        <AddPortalMaintenanceRequestDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((req: any) => (
                <div
                  key={req.id}
                  className="border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {propertyMap.get(req.property_id) ||
                        'Loading property...'}
                    </p>
                    <p className="font-semibold line-clamp-2">
                      {req.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported{' '}
                      {formatDistanceToNow(
                        new Date(req.reported_date || req.created_at),
                        { addSuffix: true }
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={getPriorityBadgeVariant(req.priority)}>
                      {req.priority}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(req.status)}>
                      {req.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p>You have not reported any maintenance issues.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
