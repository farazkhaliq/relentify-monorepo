'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button, Card } from '@relentify/ui'
import { spring, variants } from '@relentify/ui'
import { MapPin, Clock, Coffee, LogOut } from 'lucide-react'

interface Entry {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  site_id: string | null
  is_within_geofence_in: boolean | null
  status: string
}

interface ActiveBreak {
  id: string
  start_at: string
  break_type: string
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function WorkerClockPage() {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [activeBreak, setActiveBreak] = useState<ActiveBreak | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'fetching' | 'success' | 'unavailable'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clock/status')
      const data = await res.json()
      setEntry(data.entry)
      setActiveBreak(data.activeBreak)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Timer
  useEffect(() => {
    if (!entry?.clock_in_at || entry.clock_out_at) return
    const clockInTime = new Date(entry.clock_in_at).getTime()
    const update = () => setElapsed(Date.now() - clockInTime)
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [entry])

  const getGps = useCallback((): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsStatus('unavailable')
        resolve(null)
        return
      }
      setGpsStatus('fetching')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lon: pos.coords.longitude }
          setCoords(c)
          setGpsStatus('success')
          resolve(c)
        },
        () => {
          setGpsStatus('unavailable')
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }, [])

  const handleClockIn = async () => {
    setActing(true)
    const gps = await getGps()
    try {
      const res = await fetch('/api/clock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: gps?.lat ?? null,
          longitude: gps?.lon ?? null,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      if (res.ok) {
        await fetchStatus()
      }
    } finally {
      setActing(false)
    }
  }

  const handleClockOut = async () => {
    setActing(true)
    const gps = await getGps()
    try {
      const res = await fetch('/api/clock/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: gps?.lat ?? null,
          longitude: gps?.lon ?? null,
        }),
      })
      if (res.ok) {
        await fetchStatus()
      }
    } finally {
      setActing(false)
    }
  }

  const handleBreakToggle = async () => {
    setActing(true)
    const gps = await getGps()
    const endpoint = activeBreak ? '/api/clock/break/end' : '/api/clock/break/start'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: gps?.lat ?? null,
          longitude: gps?.lon ?? null,
          breakType: 'unpaid',
        }),
      })
      if (res.ok) {
        await fetchStatus()
      }
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-[var(--theme-text-muted)]">Loading...</div>
      </div>
    )
  }

  const isClockedIn = entry && !entry.clock_out_at

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-6">
      {/* GPS Status */}
      {gpsStatus !== 'idle' && (
        <Card className="w-full max-w-sm p-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className={gpsStatus === 'success' ? 'text-[var(--theme-success)]' : 'text-[var(--theme-text-muted)]'} />
            <span>
              {gpsStatus === 'fetching' && 'Getting location...'}
              {gpsStatus === 'success' && 'Location verified'}
              {gpsStatus === 'unavailable' && 'Location unavailable'}
            </span>
          </div>
        </Card>
      )}

      {isClockedIn ? (
        <>
          {/* Timer */}
          <div className="text-center">
            <div className="flex items-center gap-2 mb-2 justify-center text-[var(--theme-text-muted)]">
              <Clock size={16} />
              <span className="text-sm font-medium">Clocked in</span>
            </div>
            <div className="text-5xl font-bold font-mono tracking-tight">
              {formatDuration(elapsed)}
            </div>
            {activeBreak && (
              <div className="mt-2 flex items-center gap-1 justify-center text-[var(--theme-warning)]">
                <Coffee size={14} />
                <span className="text-sm font-medium">On break</span>
              </div>
            )}
          </div>

          {/* Break button */}
          <motion.div
            initial="rest"
            whileTap="pressed"
            variants={variants.interactive}
            transition={spring.snappy}
            className="w-full max-w-sm"
          >
            <Button
              onClick={handleBreakToggle}
              disabled={acting}
              variant="outline"
              className="w-full h-12"
            >
              <Coffee size={18} className="mr-2" />
              {activeBreak ? 'End Break' : 'Start Break'}
            </Button>
          </motion.div>

          {/* Clock out button */}
          <motion.div
            initial="rest"
            whileTap="pressed"
            variants={variants.interactive}
            transition={spring.snappy}
            className="w-full max-w-sm"
          >
            <Button
              onClick={handleClockOut}
              disabled={acting}
              variant="destructive"
              className="w-full h-14 text-lg font-semibold"
            >
              <LogOut size={20} className="mr-2" />
              Clock Out
            </Button>
          </motion.div>
        </>
      ) : (
        <>
          {/* Clock in button */}
          <motion.div
            initial="rest"
            whileTap="pressed"
            variants={variants.interactive}
            transition={spring.snappy}
            className="w-full max-w-sm"
          >
            <Button
              onClick={handleClockIn}
              disabled={acting}
              className="w-full h-20 text-xl font-bold"
            >
              <Clock size={24} className="mr-3" />
              Clock In
            </Button>
          </motion.div>

          <p className="text-sm text-[var(--theme-text-muted)]">
            Tap to start your shift
          </p>
        </>
      )}
    </div>
  )
}
