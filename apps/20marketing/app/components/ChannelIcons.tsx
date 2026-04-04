'use client'
import { MessageSquare, Mail, Phone, MessageCircle, Facebook, Instagram, Headphones } from 'lucide-react'

const CHANNELS = [
  { icon: MessageSquare, label: 'Live Chat' },
  { icon: Mail, label: 'Email' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Phone, label: 'SMS' },
  { icon: Headphones, label: 'Voice' },
  { icon: Facebook, label: 'Facebook' },
  { icon: Instagram, label: 'Instagram' },
]

export function ChannelIcons() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {CHANNELS.map(ch => (
        <div key={ch.label} className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-xl bg-[var(--theme-card)] border border-[var(--theme-border)] flex items-center justify-center">
            <ch.icon size={22} className="text-[var(--theme-primary)]" />
          </div>
          <span className="text-xs text-[var(--theme-text-muted)]">{ch.label}</span>
        </div>
      ))}
    </div>
  )
}
