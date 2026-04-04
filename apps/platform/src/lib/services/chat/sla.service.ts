import pool from '../../pool'
import { getConfig } from './config.service'
import { sseManager } from './sse.service'

export interface SLAPolicy {
  id: string
  name: string
  conditions: { priority?: string[] }
  first_response_minutes: number
  resolution_minutes: number
  business_hours_only: boolean
}

export async function getSLAPolicies(entityId: string): Promise<SLAPolicy[]> {
  const config = await getConfig(entityId)
  if (!config) return []
  const policies = (config as any).sla_policies
  return Array.isArray(policies) ? policies : []
}

export async function saveSLAPolicies(entityId: string, policies: SLAPolicy[]): Promise<void> {
  await pool.query(
    `UPDATE chat_config SET sla_policies = $1::jsonb, updated_at = NOW() WHERE entity_id = $2`,
    [JSON.stringify(policies), entityId]
  )
}

// Add sla_policies column if not exists (safe to call multiple times)
async function ensureSLAColumn(): Promise<void> {
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE chat_config ADD COLUMN IF NOT EXISTS sla_policies JSONB DEFAULT '[]';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `)
}

export async function checkSLAs(entityId: string): Promise<{ breaches: any[] }> {
  await ensureSLAColumn()
  const policies = await getSLAPolicies(entityId)
  if (policies.length === 0) return { breaches: [] }

  const breaches: any[] = []

  for (const policy of policies) {
    const priorityFilter = policy.conditions?.priority?.length
      ? `AND t.priority = ANY($2)`
      : ''
    const params: any[] = [entityId]
    if (policy.conditions?.priority?.length) params.push(policy.conditions.priority)

    // Check first response SLA
    if (policy.first_response_minutes > 0) {
      const firstResponseResult = await pool.query(
        `SELECT s.id, s.created_at, s.visitor_id
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON m.session_id = s.id AND m.sender_type IN ('agent', 'ai')
         WHERE s.entity_id = $1
           AND s.status IN ('open', 'assigned', 'waiting')
           AND s.created_at < NOW() - INTERVAL '${policy.first_response_minutes} minutes'
           AND m.id IS NULL
         LIMIT 20`,
        [entityId]
      )
      for (const row of firstResponseResult.rows) {
        breaches.push({
          type: 'first_response',
          policy_name: policy.name,
          session_id: row.id,
          target_minutes: policy.first_response_minutes,
          created_at: row.created_at,
        })
      }
    }

    // Check resolution SLA
    if (policy.resolution_minutes > 0) {
      const resolutionResult = await pool.query(
        `SELECT id, created_at
         FROM chat_sessions
         WHERE entity_id = $1
           AND status IN ('open', 'assigned', 'waiting')
           AND created_at < NOW() - INTERVAL '${policy.resolution_minutes} minutes'
         LIMIT 20`,
        [entityId]
      )
      for (const row of resolutionResult.rows) {
        breaches.push({
          type: 'resolution',
          policy_name: policy.name,
          session_id: row.id,
          target_minutes: policy.resolution_minutes,
          created_at: row.created_at,
        })
      }
    }
  }

  // Broadcast breaches via SSE
  if (breaches.length > 0) {
    sseManager.broadcastEntity(entityId, 'sla_breach', { breaches })
  }

  return { breaches }
}
