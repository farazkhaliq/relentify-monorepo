'use client'

import { MessageSquare, Mail, Phone, MessageCircle, Facebook, Instagram, Headphones } from 'lucide-react'

const CHANNELS = [
  { value: '', label: 'All', icon: null },
  { value: 'web', label: 'Web', icon: MessageSquare },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: Phone },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'voice', label: 'Voice', icon: Headphones },
]

export function getChannelIcon(channel: string) {
  const ch = CHANNELS.find(c => c.value === channel)
  return ch?.icon || MessageSquare
}

export function getChannelLabel(channel: string) {
  const ch = CHANNELS.find(c => c.value === channel)
  return ch?.label || channel
}

interface ChannelFilterProps {
  selected: string
  onChange: (channel: string) => void
}

export default function ChannelFilter({ selected, onChange }: ChannelFilterProps) {
  return (
    <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-[var(--theme-border)]">
      {CHANNELS.map(ch => {
        const Icon = ch.icon
        return (
          <button
            key={ch.value}
            onClick={() => onChange(ch.value)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full whitespace-nowrap ${
              selected === ch.value
                ? 'bg-[var(--theme-primary)] text-white'
                : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-border)]'
            }`}
          >
            {Icon && <Icon size={12} />}
            {ch.label}
          </button>
        )
      })}
    </div>
  )
}
