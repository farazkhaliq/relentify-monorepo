// src/lib/cron-monitor.service.ts
import { query } from './db'

export async function startCronRun(jobName: string): Promise<string> {
  const r = await query(
    `INSERT INTO cron_runs (job_name, status) VALUES ($1, 'running') RETURNING id`,
    [jobName]
  )
  return r.rows[0].id as string
}

export async function finishCronRun(
  runId: string,
  status: 'success' | 'failed',
  recordsProcessed?: number,
  error?: string
): Promise<void> {
  await query(
    `UPDATE cron_runs
     SET status=$1, finished_at=NOW(), records_processed=$2, error=$3
     WHERE id=$4`,
    [status, recordsProcessed ?? null, error ?? null, runId]
  )

  if (status === 'failed') {
    await alertOnFailure(runId, error ?? 'Unknown error')
  }
}

async function alertOnFailure(runId: string, error: string): Promise<void> {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN
  const telegramChat  = process.env.TELEGRAM_CHAT_ID
  if (!telegramToken || !telegramChat) return

  const msg = `🔴 Cron job failed\nRun ID: ${runId}\nError: ${error}`
  await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChat, text: msg }),
    }
  ).catch(console.error)
}
