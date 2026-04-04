import webpush from 'web-push'
import pool from '../../pool'

// Configure VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@relentify.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPush(
  subscription: PushSubscription,
  title: string,
  body: string,
  url?: string
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ title, body, url: url || '/' })
    )
    return true
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — remove it
      await pool.query('DELETE FROM chat_push_subscriptions WHERE endpoint = $1', [subscription.endpoint]).catch(() => {})
    }
    return false
  }
}

export async function sendToEntity(
  entityId: string,
  title: string,
  body: string,
  url?: string
): Promise<number> {
  const result = await pool.query(
    'SELECT endpoint, p256dh, auth FROM chat_push_subscriptions WHERE entity_id = $1',
    [entityId]
  )

  let sent = 0
  for (const sub of result.rows) {
    const success = await sendPush(sub, title, body, url)
    if (success) sent++
  }
  return sent
}

export async function subscribe(
  entityId: string,
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await pool.query(
    `INSERT INTO chat_push_subscriptions (entity_id, user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $4, auth = $5`,
    [entityId, userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  )
}

export async function unsubscribe(endpoint: string): Promise<void> {
  await pool.query('DELETE FROM chat_push_subscriptions WHERE endpoint = $1', [endpoint])
}
