import type { Pool } from 'pg'

export type { Pool }

export interface ChatSession {
  id: string; entity_id: string; visitor_id: string; assigned_agent_id: string | null
  status: string; channel: string; subject: string | null; department: string | null
  ai_enabled: boolean; rating: number | null; rating_comment: string | null
  metadata: Record<string, any>; created_at: string; updated_at: string; resolved_at: string | null
}

export interface ChatMessage {
  id: string; session_id: string; entity_id: string
  sender_type: 'visitor' | 'agent' | 'ai' | 'system' | 'note'
  sender_id: string | null; body: string; attachment_url: string | null
  metadata: Record<string, any>; created_at: string
}

export interface ChatVisitor {
  id: string; entity_id: string; fingerprint: string
  name: string | null; email: string | null; ip_address: string | null
  user_agent: string | null; page_url: string | null
  custom_data: Record<string, any>; banned: boolean
  last_seen_at: string; created_at: string
}

export interface ChatConfig {
  id: string; entity_id: string
  widget_colour: string; widget_position: string; widget_greeting: string
  widget_offline_message: string; widget_show_branding: boolean
  ai_enabled: boolean; ai_model: string; ai_system_prompt: string
  ai_max_tokens: number; ai_temperature: number
  routing_method: string; auto_assign: boolean
  canned_responses: any[]; plan: string
  [key: string]: any
}
