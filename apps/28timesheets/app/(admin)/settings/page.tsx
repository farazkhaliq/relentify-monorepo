'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Input, Label, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui'

interface Settings {
  require_gps: boolean; require_photo: boolean; gps_ping_interval_minutes: number
  auto_clock_out_enabled: boolean; auto_clock_out_after_minutes: number; auto_clock_out_at_shift_end: boolean
  deduction_mode: string; deduction_type: string; fixed_deduction_minutes: number | null
  project_tag_required: boolean; allow_early_clock_in_minutes: number; allow_late_clock_out_minutes: number
  gps_retention_days: number; photo_retention_days: number
}

const DEFAULTS: Settings = {
  require_gps: true, require_photo: false, gps_ping_interval_minutes: 30,
  auto_clock_out_enabled: true, auto_clock_out_after_minutes: 720, auto_clock_out_at_shift_end: true,
  deduction_mode: 'flag_for_review', deduction_type: 'dynamic', fixed_deduction_minutes: null,
  project_tag_required: false, allow_early_clock_in_minutes: 15, allow_late_clock_out_minutes: 15,
  gps_retention_days: 90, photo_retention_days: 90,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings) setSettings(s => ({ ...s, ...d.settings }))
      setLoaded(true)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
  }

  if (!loaded) return <div className="animate-pulse p-4">Loading settings...</div>

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="p-5 mb-4"><h3 className="font-semibold mb-4">{title}</h3><div className="grid gap-4">{children}</div></Card>
  )

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between"><Label>{label}</Label>{children}</div>
  )

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Section title="GPS">
        <Row label="Require GPS"><Switch checked={settings.require_gps} onCheckedChange={v => setSettings(s => ({ ...s, require_gps: v }))} /></Row>
        <div><Label>Ping Interval (minutes)</Label>
          <Select value={String(settings.gps_ping_interval_minutes)} onValueChange={v => setSettings(s => ({ ...s, gps_ping_interval_minutes: parseInt(v) }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="Photos">
        <Row label="Require photo on clock-in"><Switch checked={settings.require_photo} onCheckedChange={v => setSettings(s => ({ ...s, require_photo: v }))} /></Row>
      </Section>

      <Section title="Auto Clock-Out">
        <Row label="Enabled"><Switch checked={settings.auto_clock_out_enabled} onCheckedChange={v => setSettings(s => ({ ...s, auto_clock_out_enabled: v }))} /></Row>
        <div><Label>Max Hours Before Auto Clock-Out</Label><Input type="number" value={settings.auto_clock_out_after_minutes / 60} onChange={e => setSettings(s => ({ ...s, auto_clock_out_after_minutes: Math.round(parseFloat(e.target.value || '12') * 60) }))} /></div>
        <Row label="Auto clock-out at shift end"><Switch checked={settings.auto_clock_out_at_shift_end} onCheckedChange={v => setSettings(s => ({ ...s, auto_clock_out_at_shift_end: v }))} /></Row>
        <div><Label>Deduction Mode</Label>
          <Select value={settings.deduction_mode} onValueChange={v => setSettings(s => ({ ...s, deduction_mode: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="flag_for_review">Flag for Review</SelectItem>
              <SelectItem value="auto">Auto Deduct</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Deduction Type</Label>
          <Select value={settings.deduction_type} onValueChange={v => setSettings(s => ({ ...s, deduction_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dynamic">Dynamic (from last GPS ping)</SelectItem>
              <SelectItem value="fixed">Fixed minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {settings.deduction_type === 'fixed' && (
          <div><Label>Fixed Deduction (minutes)</Label><Input type="number" value={settings.fixed_deduction_minutes ?? ''} onChange={e => setSettings(s => ({ ...s, fixed_deduction_minutes: parseInt(e.target.value) || null }))} /></div>
        )}
      </Section>

      <Section title="Shifts">
        <Row label="Require project tag"><Switch checked={settings.project_tag_required} onCheckedChange={v => setSettings(s => ({ ...s, project_tag_required: v }))} /></Row>
        <div><Label>Early Clock-In Window (minutes)</Label><Input type="number" value={settings.allow_early_clock_in_minutes} onChange={e => setSettings(s => ({ ...s, allow_early_clock_in_minutes: parseInt(e.target.value) || 15 }))} /></div>
        <div><Label>Late Clock-Out Window (minutes)</Label><Input type="number" value={settings.allow_late_clock_out_minutes} onChange={e => setSettings(s => ({ ...s, allow_late_clock_out_minutes: parseInt(e.target.value) || 15 }))} /></div>
      </Section>

      <Section title="Data Retention (GDPR)">
        <div><Label>GPS Data Retention (days)</Label><Input type="number" value={settings.gps_retention_days} onChange={e => setSettings(s => ({ ...s, gps_retention_days: parseInt(e.target.value) || 90 }))} /></div>
        <div><Label>Photo Retention (days)</Label><Input type="number" value={settings.photo_retention_days} onChange={e => setSettings(s => ({ ...s, photo_retention_days: parseInt(e.target.value) || 90 }))} /></div>
      </Section>

      <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Settings'}</Button>
    </div>
  )
}
