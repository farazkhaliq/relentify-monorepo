import { query } from './db'
import { v4 as uuid } from 'uuid'

export async function importWorkersFromCsv(
  userId: string, entityId: string, csvContent: string
): Promise<{ created: number; errors: string[] }> {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return { created: 0, errors: ['CSV must have a header row and at least one data row'] }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const nameIdx = header.indexOf('name')
  const emailIdx = header.indexOf('email')
  const rateIdx = header.indexOf('hourly_rate')

  if (nameIdx === -1 || emailIdx === -1) {
    return { created: 0, errors: ['CSV must have "name" and "email" columns'] }
  }

  let created = 0
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const name = cols[nameIdx]
    const email = cols[emailIdx]
    const hourlyRate = rateIdx !== -1 ? parseFloat(cols[rateIdx]) || null : null

    if (!name || !email) {
      errors.push(`Row ${i + 1}: missing name or email`)
      continue
    }

    try {
      // Check if user exists
      let workerUserId: string
      const existing = await query(`SELECT id FROM users WHERE email = $1`, [email])

      if (existing.rows[0]) {
        workerUserId = existing.rows[0].id
      } else {
        // Create user with random password (they'll reset via 21auth)
        const newId = uuid()
        await query(
          `INSERT INTO users (id, email, full_name, password_hash, user_type)
           VALUES ($1, $2, $3, $4, 'sole_trader')`,
          [newId, email, name, 'IMPORT_NEEDS_RESET_' + uuid()]
        )
        workerUserId = newId
      }

      // Create workspace member if not exists
      const memberExists = await query(
        `SELECT id FROM acc_workspace_members WHERE owner_user_id = $1 AND (member_user_id = $2 OR invited_email = $3)`,
        [userId, workerUserId, email]
      )
      if (!memberExists.rows[0]) {
        await query(
          `INSERT INTO acc_workspace_members (owner_user_id, member_user_id, invited_email, role, status, permissions)
           VALUES ($1, $2, $3, 'staff', 'active', $4)`,
          [userId, workerUserId, email, JSON.stringify({
            timesheets: { view: true, create: true, approve: false },
            scheduling: { view: true, create: false, assign: false },
            reports: { view: false, export: false },
            settings: { view: false, manage: false },
            team: { view: false, manage: false },
            sites: { view: true, manage: false },
          })]
        )
      }

      // Create ts_workers if not exists
      const workerExists = await query(
        `SELECT id FROM ts_workers WHERE user_id = $1 AND entity_id = $2 AND worker_user_id = $3`,
        [userId, entityId, workerUserId]
      )
      if (!workerExists.rows[0]) {
        await query(
          `INSERT INTO ts_workers (user_id, entity_id, worker_user_id, hourly_rate)
           VALUES ($1, $2, $3, $4)`,
          [userId, entityId, workerUserId, hourlyRate]
        )
      }

      created++
    } catch (err) {
      errors.push(`Row ${i + 1} (${email}): ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return { created, errors }
}
