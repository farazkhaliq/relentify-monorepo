'use client'

import useSWR from 'swr'

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : null))

export interface PortalUserProfile {
  id: string
  entity_id: string
  contact_id: string | null
  email: string
  full_name: string
  role: 'Tenant' | 'Landlord'
  is_active: boolean
}

export function usePortalUserProfile() {
  const { data, isLoading, error } = useSWR<PortalUserProfile | null>(
    '/api/portal/auth/me',
    fetcher,
    { refreshInterval: 60000 }
  )
  return { portalUserProfile: data || null, isLoading, error }
}
