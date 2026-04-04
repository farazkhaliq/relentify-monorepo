'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Badge, Switch } from '@relentify/ui'
import { Plus, MapPin, Trash2 } from 'lucide-react'

interface Site {
  id: string; name: string; address: string | null; latitude: number | null; longitude: number | null
  geofence_radius_metres: number | null; require_photo_on_punch: boolean; is_active: boolean
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', geofenceRadius: '200', requirePhoto: false })

  const fetchSites = useCallback(async () => {
    const res = await fetch('/api/sites')
    const data = await res.json()
    setSites(data.sites || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSites() }, [fetchSites])

  const handleCreate = async () => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        address: form.address || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        geofenceRadius: form.geofenceRadius ? parseInt(form.geofenceRadius) : undefined,
        requirePhoto: form.requirePhoto,
      }),
    })
    if (res.ok) {
      setDialogOpen(false)
      setForm({ name: '', address: '', latitude: '', longitude: '', geofenceRadius: '200', requirePhoto: false })
      fetchSites()
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/sites/${id}`, { method: 'DELETE' })
    fetchSites()
  }

  if (loading) return <div className="animate-pulse p-4">Loading sites...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus size={16} className="mr-1" /> Add Site</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map(site => (
          <Card key={site.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-1"><MapPin size={14} /> {site.name}</h3>
                {site.address && <p className="text-sm text-[var(--theme-text-muted)] mt-1">{site.address}</p>}
              </div>
              <button onClick={() => handleDelete(site.id)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)]">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {site.geofence_radius_metres && <Badge variant="outline">{site.geofence_radius_metres}m geofence</Badge>}
              {site.require_photo_on_punch && <Badge variant="outline">Photo required</Badge>}
            </div>
          </Card>
        ))}
        {sites.length === 0 && <p className="text-[var(--theme-text-muted)] col-span-full">No sites yet. Add your first site to enable geofencing.</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Site</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Oak Road Office" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Oak Road, London" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="51.5074" /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-0.1278" /></div>
            </div>
            <div><Label>Geofence Radius (metres)</Label><Input type="number" value={form.geofenceRadius} onChange={e => setForm(f => ({ ...f, geofenceRadius: e.target.value }))} /></div>
            <div className="flex items-center justify-between">
              <Label>Require photo on clock-in</Label>
              <Switch checked={form.requirePhoto} onCheckedChange={v => setForm(f => ({ ...f, requirePhoto: v }))} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={!form.name}>Create Site</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
