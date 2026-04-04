'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useApiDoc, useApiCollection, apiUpdate } from '@/hooks/use-api'
import { PLAN_DISPLAY } from '@/lib/tiers'

const TABS = ['Channels', 'Voice', 'Bots', 'Workflows', 'Billing']

export default function SettingsPage() {
  const [tab, setTab] = useState('Channels')
  const { data: channels, mutate: refreshChannels } = useApiCollection<any>('/api/channels')
  const { data: voiceConfig, mutate: refreshVoice } = useApiDoc<any>('/api/voice/config')

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-[var(--theme-primary)]" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-1.5 rounded-full ${tab === t ? 'bg-[var(--theme-primary)] text-white' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>{t}</button>
        ))}
      </div>

      <div className="border border-[var(--theme-border)] rounded-xl p-6 max-w-2xl">
        {tab === 'Channels' && (
          <div>
            <h2 className="text-sm font-bold mb-3">Configured Channels</h2>
            {channels.length === 0 && <p className="text-sm text-[var(--theme-text-muted)]">No channels configured yet.</p>}
            {channels.map((c: any) => (
              <div key={c.id} className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
                <div><span className="text-sm font-medium capitalize">{c.channel_type}</span>
                  <span className={`ml-2 text-xs ${c.enabled ? 'text-[var(--theme-success)]' : 'text-[var(--theme-text-muted)]'}`}>{c.enabled ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-[var(--theme-text-dim)] mt-3">Configure channels via the API: POST /api/channels</p>
          </div>
        )}

        {tab === 'Voice' && (
          <div>
            <h2 className="text-sm font-bold mb-3">Voice Settings</h2>
            <div className="space-y-2 text-sm">
              <div>Phone: <span className="font-mono">{voiceConfig?.twilio_phone_number || 'Not configured'}</span></div>
              <div>Voicemail: {voiceConfig?.voicemail_enabled ? 'Enabled' : 'Disabled'}</div>
              <div>Recording: {voiceConfig?.recording_enabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <p className="text-xs text-[var(--theme-text-dim)] mt-3">Configure via PATCH /api/voice/config</p>
          </div>
        )}

        {tab === 'Bots' && (
          <div>
            <h2 className="text-sm font-bold mb-3">Bot Settings</h2>
            <p className="text-sm text-[var(--theme-text-muted)]">Manage chatbots from the <a href="/bots" className="text-[var(--theme-primary)] underline">Bots page</a>.</p>
          </div>
        )}

        {tab === 'Workflows' && (
          <div>
            <h2 className="text-sm font-bold mb-3">Workflow Settings</h2>
            <p className="text-sm text-[var(--theme-text-muted)]">Manage workflows from the <a href="/workflows" className="text-[var(--theme-primary)] underline">Workflows page</a>.</p>
          </div>
        )}

        {tab === 'Billing' && (
          <div>
            <h2 className="text-sm font-bold mb-4">Plans</h2>
            <div className="grid gap-3">
              {(Object.entries(PLAN_DISPLAY) as [string, any][]).map(([key, plan]) => (
                <div key={key} className="border border-[var(--theme-border)] rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">{plan.name}</span>
                    <span className="text-sm text-[var(--theme-text-muted)]">{plan.price}</span>
                  </div>
                  <div className="text-xs text-[var(--theme-text-muted)]">{plan.features.join(' · ')}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--theme-text-dim)] mt-4">Stripe billing integration coming soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}
