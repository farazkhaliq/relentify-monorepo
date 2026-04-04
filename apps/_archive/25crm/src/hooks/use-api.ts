'use client'

import useSWR, { mutate } from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json()
}

export function useApiCollection<T = any>(path: string | null) {
  const { data, error, isLoading, mutate: boundMutate } = useSWR<T[]>(
    path,
    fetcher,
    { refreshInterval: 15000 }
  )
  return { data: data || [], isLoading, error, mutate: boundMutate }
}

export function useApiDoc<T = any>(path: string | null) {
  const { data, error, isLoading, mutate: boundMutate } = useSWR<T>(
    path,
    fetcher,
    { refreshInterval: 15000 }
  )
  return { data: data ?? null, isLoading, error, mutate: boundMutate }
}

export async function apiCreate<T = any>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  mutate(path)
  return data
}

export async function apiUpdate<T = any>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  mutate(path)
  const listPath = path.replace(/\/[^/]+$/, '')
  mutate(listPath)
  return data
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  const listPath = path.replace(/\/[^/]+$/, '')
  mutate(listPath)
}
