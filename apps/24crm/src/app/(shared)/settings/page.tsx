'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useApiDoc, apiUpdate, apiCreate, apiDelete, useApiCollection } from '@/hooks/use-api'
import { PLAN_DISPLAY, CONNECT_PLAN_DISPLAY } from '@/lib/tiers'

function useProduct() {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host.includes('chat.')) return 'chat'
  if (host.includes('connect.')) return 'connect'
  return 'crm'
}

const CHAT_TABS = ['Widget', 'AI', 'Business', 'Routing', 'Canned', 'Triggers', 'Webhooks', 'API Keys', 'Billing']
const CONNECT_TABS = ['Channels', 'Voice', 'Widget', 'AI', 'Business', 'Routing', 'Canned', 'Triggers', 'Webhooks', 'API Keys', 'Billing']

export default function SettingsPage() {
  const product = useProduct()
  const tabs = product === 'chat' ? CHAT_TABS : CONNECT_TABS
  const [tab, setTab] = useState(tabs[0])
  const { data: config, mutate: refreshConfig } = useApiDoc<any>('/api/config')

  async function updateConfig(updates: Record<string, any>) {
    await apiUpdate('/api/config', updates)
    refreshConfig()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-[var(--theme-primary)]" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-1.5 rounded-full ${tab === t ? 'bg-[var(--theme-primary)] text-white' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>
            {t}
          </button>
        ))}
      </div>

      {!config && tab !== 'Channels' && tab !== 'Voice' && tab !== 'Billing' ? (
        <div className="text-[var(--theme-text-muted)]">Loading...</div>
      ) : (
        <div className="border border-[var(--theme-border)] rounded-xl p-6 max-w-2xl">
          {tab === 'Channels' && <ChannelsTab />}
          {tab === 'Voice' && <VoiceTab />}
          {tab === 'Widget' && <WidgetTab config={config} onSave={updateConfig} />}
          {tab === 'AI' && <AITab config={config} onSave={updateConfig} />}
          {tab === 'Business' && <BusinessTab config={config} onSave={updateConfig} />}
          {tab === 'Routing' && <RoutingTab config={config} onSave={updateConfig} />}
          {tab === 'Canned' && <CannedTab config={config} onSave={updateConfig} />}
          {tab === 'Triggers' && <TriggersTab />}
          {tab === 'Webhooks' && <WebhooksTab />}
          {tab === 'API Keys' && <ApiKeysTab />}
          {tab === 'Billing' && <BillingTab config={config} product={product} />}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><label className="text-sm font-medium block mb-1">{label}</label>{children}</div>
}

function Input({ value, onChange, type = 'text', ...props }: any) {
  return <input type={type} value={value || ''} onChange={(e: any) => onChange(e.target.value)} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none" {...props} />
}

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return <button onClick={onClick} disabled={saving} className="mt-4 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
}

function ChannelsTab() {
  const { data: channels } = useApiCollection<any>('/api/channels')
  return <div>
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
}

function VoiceTab() {
  const { data: voiceConfig } = useApiDoc<any>('/api/voice/config')
  return <div>
    <h2 className="text-sm font-bold mb-3">Voice Settings</h2>
    <div className="space-y-2 text-sm">
      <div>Phone: <span className="font-mono">{voiceConfig?.twilio_phone_number || 'Not configured'}</span></div>
      <div>Voicemail: {voiceConfig?.voicemail_enabled ? 'Enabled' : 'Disabled'}</div>
      <div>Recording: {voiceConfig?.recording_enabled ? 'Enabled' : 'Disabled'}</div>
    </div>
    <p className="text-xs text-[var(--theme-text-dim)] mt-3">Configure via PATCH /api/voice/config</p>
  </div>
}

function WidgetTab({ config, onSave }: any) {
  const [s, setS] = useState({ widget_colour: config.widget_colour, widget_position: config.widget_position, widget_greeting: config.widget_greeting, widget_offline_message: config.widget_offline_message, widget_show_branding: config.widget_show_branding, pre_chat_form_enabled: config.pre_chat_form_enabled })
  const [saving, setSaving] = useState(false)
  return <div>
    <Field label="Widget Colour"><Input value={s.widget_colour} onChange={(v: string) => setS({...s, widget_colour: v})} type="color" /></Field>
    <Field label="Position"><select value={s.widget_position} onChange={(e: any) => setS({...s, widget_position: e.target.value})} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm"><option value="bottom-right">Bottom Right</option><option value="bottom-left">Bottom Left</option></select></Field>
    <Field label="Greeting"><Input value={s.widget_greeting} onChange={(v: string) => setS({...s, widget_greeting: v})} /></Field>
    <Field label="Offline Message"><Input value={s.widget_offline_message} onChange={(v: string) => setS({...s, widget_offline_message: v})} /></Field>
    <Field label="Pre-chat Form"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.pre_chat_form_enabled} onChange={(e: any) => setS({...s, pre_chat_form_enabled: e.target.checked})} /> Require name/email before chat</label></Field>
    <SaveBtn saving={saving} onClick={async () => { setSaving(true); await onSave(s); setSaving(false) }} />
  </div>
}

function AITab({ config, onSave }: any) {
  const [s, setS] = useState({ ai_enabled: config.ai_enabled, ai_model: config.ai_model, ai_system_prompt: config.ai_system_prompt, ai_max_tokens: config.ai_max_tokens, ai_temperature: config.ai_temperature, ai_auto_reply: config.ai_auto_reply })
  const [saving, setSaving] = useState(false)
  return <div>
    <Field label="AI Enabled"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.ai_enabled} onChange={(e: any) => setS({...s, ai_enabled: e.target.checked})} /> Enable AI auto-replies</label></Field>
    <Field label="Model"><Input value={s.ai_model} onChange={(v: string) => setS({...s, ai_model: v})} /></Field>
    <Field label="System Prompt"><textarea value={s.ai_system_prompt || ''} onChange={(e: any) => setS({...s, ai_system_prompt: e.target.value})} rows={4} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none" /></Field>
    <Field label="Max Tokens"><Input value={s.ai_max_tokens} onChange={(v: string) => setS({...s, ai_max_tokens: parseInt(v) || 500})} type="number" /></Field>
    <Field label="Temperature"><Input value={s.ai_temperature} onChange={(v: string) => setS({...s, ai_temperature: parseFloat(v) || 0.7})} type="number" step="0.1" min="0" max="2" /></Field>
    <SaveBtn saving={saving} onClick={async () => { setSaving(true); await onSave(s); setSaving(false) }} />
  </div>
}

function BusinessTab({ config, onSave }: any) {
  const [s, setS] = useState({ business_name: config.business_name, business_description: config.business_description, business_timezone: config.business_timezone })
  const [saving, setSaving] = useState(false)
  return <div>
    <Field label="Business Name"><Input value={s.business_name} onChange={(v: string) => setS({...s, business_name: v})} /></Field>
    <Field label="Description"><textarea value={s.business_description || ''} onChange={(e: any) => setS({...s, business_description: e.target.value})} rows={3} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none" /></Field>
    <Field label="Timezone"><Input value={s.business_timezone} onChange={(v: string) => setS({...s, business_timezone: v})} /></Field>
    <SaveBtn saving={saving} onClick={async () => { setSaving(true); await onSave(s); setSaving(false) }} />
  </div>
}

function RoutingTab({ config, onSave }: any) {
  const [s, setS] = useState({ routing_method: config.routing_method, auto_assign: config.auto_assign })
  const [saving, setSaving] = useState(false)
  return <div>
    <Field label="Routing Method"><select value={s.routing_method} onChange={(e: any) => setS({...s, routing_method: e.target.value})} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm"><option value="round-robin">Round Robin</option><option value="least-busy">Least Busy</option></select></Field>
    <Field label="Auto Assign"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.auto_assign} onChange={(e: any) => setS({...s, auto_assign: e.target.checked})} /> Automatically assign new sessions</label></Field>
    <SaveBtn saving={saving} onClick={async () => { setSaving(true); await onSave(s); setSaving(false) }} />
  </div>
}

function CannedTab({ config, onSave }: any) {
  const [responses, setResponses] = useState<any[]>(config.canned_responses || [])
  const [saving, setSaving] = useState(false)
  return <div>
    {responses.map((r: any, i: number) => (
      <div key={i} className="flex gap-2 mb-2">
        <Input value={r.title} onChange={(v: string) => { const nr = [...responses]; nr[i].title = v; setResponses(nr) }} placeholder="Title" />
        <Input value={r.body} onChange={(v: string) => { const nr = [...responses]; nr[i].body = v; setResponses(nr) }} placeholder="Message body" />
        <button onClick={() => setResponses(responses.filter((_: any, j: number) => j !== i))} className="text-[var(--theme-destructive)] text-sm px-2">X</button>
      </div>
    ))}
    <button onClick={() => setResponses([...responses, { title: '', body: '' }])} className="text-sm text-[var(--theme-primary)] mb-4">+ Add Response</button>
    <br />
    <SaveBtn saving={saving} onClick={async () => { setSaving(true); await onSave({ canned_responses: responses }); setSaving(false) }} />
  </div>
}

function TriggersTab() {
  const { data: triggers, mutate } = useApiCollection<any>('/api/triggers')
  return <div>
    <p className="text-sm text-[var(--theme-text-muted)] mb-3">{triggers.length} trigger{triggers.length !== 1 ? 's' : ''} configured</p>
    {triggers.map((t: any) => (
      <div key={t.id} className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
        <div><span className="text-sm font-medium">{t.name}</span><span className={`ml-2 text-xs ${t.enabled ? 'text-[var(--theme-success)]' : 'text-[var(--theme-text-muted)]'}`}>{t.enabled ? 'Active' : 'Disabled'}</span></div>
        <button onClick={async () => { await apiDelete(`/api/triggers/${t.id}`); mutate() }} className="text-xs text-[var(--theme-destructive)]">Delete</button>
      </div>
    ))}
  </div>
}

function WebhooksTab() {
  return <div>
    <p className="text-sm text-[var(--theme-text-muted)]">Configure webhook endpoints to receive real-time events. Manage via the API.</p>
    <p className="text-xs text-[var(--theme-text-dim)] mt-2">Events: chat.session.created, chat.message.created, chat.session.resolved, chat.ticket.created</p>
  </div>
}

function ApiKeysTab() {
  const { data: keys, mutate } = useApiCollection<any>('/api/api-keys')
  const [newKey, setNewKey] = useState<string | null>(null)
  return <div>
    {newKey && (
      <div className="mb-4 p-3 bg-[var(--theme-success)]/10 rounded-lg text-sm">
        <p className="font-medium text-[var(--theme-success)]">New API key created — copy it now, it won't be shown again:</p>
        <code className="block mt-1 font-mono text-xs break-all">{newKey}</code>
      </div>
    )}
    {keys.map((k: any) => (
      <div key={k.id} className="flex justify-between items-center py-2 border-b border-[var(--theme-border)]">
        <div><span className="text-sm font-medium">{k.name}</span><span className="ml-2 text-xs text-[var(--theme-text-muted)] font-mono">{k.key_prefix}...</span></div>
        <button onClick={async () => { await apiDelete(`/api/api-keys/${k.id}`); mutate() }} className="text-xs text-[var(--theme-destructive)]">Revoke</button>
      </div>
    ))}
    <button onClick={async () => {
      const name = prompt('Key name:')
      if (!name) return
      const res = await apiCreate('/api/api-keys', { name })
      setNewKey(res.key)
      mutate()
    }} className="mt-3 text-sm text-[var(--theme-primary)]">+ Create API Key</button>
  </div>
}

function BillingTab({ config, product }: { config: any; product: string }) {
  if (product !== 'chat') {
    return <div>
      <h2 className="text-sm font-bold mb-4">Connect Plans</h2>
      <div className="grid gap-3">
        {(Object.entries(CONNECT_PLAN_DISPLAY) as [string, any][]).map(([key, plan]) => (
          <div key={key} className="border border-[var(--theme-border)] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">{plan.name}</span>
              <span className="text-sm text-[var(--theme-text-muted)]">{plan.price}</span>
            </div>
            <div className="text-xs text-[var(--theme-text-muted)]">{plan.features.join(' · ')}</div>
          </div>
        ))}
      </div>
    </div>
  }

  return <div>
    <div className="text-sm mb-4">
      Current plan: <span className="font-bold capitalize">{config?.plan || 'free'}</span>
    </div>
    <div className="space-y-2 text-sm text-[var(--theme-text-muted)]">
      {(Object.entries(PLAN_DISPLAY) as [string, any][]).map(([key, plan]) => (
        <p key={key}><strong>{plan.name}:</strong> {plan.price}</p>
      ))}
    </div>
  </div>
}
