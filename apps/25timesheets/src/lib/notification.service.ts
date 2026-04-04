import webpush from 'web-push'
import { query } from './db'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@relentify.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function sendPush(
  workerUserId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const subs = await query(
    `SELECT * FROM ts_push_subscriptions WHERE worker_user_id = $1`,
    [workerUserId]
  )

  for (const sub of subs.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      await query(
        `UPDATE ts_push_subscriptions SET last_used_at = NOW() WHERE id = $1`,
        [sub.id]
      )
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 410 || status === 404) {
        await query(`DELETE FROM ts_push_subscriptions WHERE id = $1`, [sub.id])
      }
    }
  }
}

export async function sendToManagers(
  entityId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  // Get all managers/admins/owners for this entity
  const managers = await query(
    `SELECT DISTINCT wm.member_user_id FROM acc_workspace_members wm
     WHERE wm.owner_user_id = (SELECT user_id FROM ts_settings WHERE entity_id = $1 LIMIT 1)
     AND wm.role IN ('owner', 'admin', 'manager') AND wm.status = 'active'
     AND wm.member_user_id IS NOT NULL`,
    [entityId]
  )
  for (const row of managers.rows) {
    await sendPush(row.member_user_id, payload)
  }
}

export async function subscribeDevice(data: {
  userId: string; workerUserId: string; endpoint: string; p256dh: string; auth: string; deviceLabel?: string
}): Promise<void> {
  await query(
    `INSERT INTO ts_push_subscriptions (user_id, worker_user_id, endpoint, p256dh, auth, device_label)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $4, auth = $5, device_label = $6, last_used_at = NOW()`,
    [data.userId, data.workerUserId, data.endpoint, data.p256dh, data.auth, data.deviceLabel || null]
  )
}

export async function unsubscribeDevice(endpoint: string): Promise<void> {
  await query(`DELETE FROM ts_push_subscriptions WHERE endpoint = $1`, [endpoint])
}
