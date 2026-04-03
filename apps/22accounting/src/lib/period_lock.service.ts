import { query } from './db';

export interface LockCheck {
  locked: boolean;
  lockedThrough: string | null;   // YYYY-MM-DD
  reason: string | null;
  earliestUnlockedDate: string;   // YYYY-MM-DD — today if not locked
}

export interface PeriodLockEvent {
  id: string;
  lock_type: 'vat_filing' | 'manual_year_end' | 'unlock';
  from_date: string;
  to_date: string;
  reason: string | null;
  locked_by_name: string;
  created_at: string;
}

export interface PeriodOverride {
  id: string;
  user_id: string;
  user_name: string;
  granted_by_name: string;
  override_until: string;
  created_at: string;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns the day after lockedThrough, or today if not locked */
function dayAfter(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatLockReason(event: { lock_type: string; created_at: string | Date }): string {
  const date = new Date(event.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  if (event.lock_type === 'vat_filing') return `VAT return filed ${date}`;
  if (event.lock_type === 'manual_year_end') return `Year-end lock applied ${date}`;
  return `Period locked ${date}`;
}

/**
 * Check whether a given date falls in a locked period for this entity+user.
 * If the user has an active override, returns locked: false.
 */
export async function isDateLocked(
  entityId: string,
  date: string,
  userId: string
): Promise<LockCheck> {
  // Check user override first
  const overrideRes = await query(
    `SELECT 1 FROM acc_period_overrides
     WHERE entity_id=$1 AND user_id=$2 AND override_until > NOW()`,
    [entityId, userId]
  );
  if (overrideRes.rows.length > 0) {
    return { locked: false, lockedThrough: null, reason: null, earliestUnlockedDate: today() };
  }

  // Get entity lock boundary
  const entityRes = await query(
    `SELECT locked_through_date FROM entities WHERE id=$1`,
    [entityId]
  );
  const lockedThrough: string | null = entityRes.rows[0]?.locked_through_date
    ? new Date(entityRes.rows[0].locked_through_date).toISOString().split('T')[0]
    : null;

  if (!lockedThrough || date > lockedThrough) {
    return { locked: false, lockedThrough, reason: null, earliestUnlockedDate: today() };
  }

  // Find the most recent lock event for a human-readable reason
  const eventRes = await query(
    `SELECT lock_type, created_at FROM acc_period_lock_events
     WHERE entity_id=$1 AND lock_type != 'unlock'
     ORDER BY created_at DESC LIMIT 1`,
    [entityId]
  );
  const reason = eventRes.rows[0] ? formatLockReason(eventRes.rows[0]) : 'Period is locked';

  return {
    locked: true,
    lockedThrough,
    reason,
    earliestUnlockedDate: dayAfter(lockedThrough),
  };
}

/** Returns earliest date a user can post to (respects override) */
export async function getEarliestUnlockedDate(entityId: string, userId?: string): Promise<string> {
  if (userId) {
    const overrideRes = await query(
      `SELECT 1 FROM acc_period_overrides
       WHERE entity_id=$1 AND user_id=$2 AND override_until > NOW()`,
      [entityId, userId]
    );
    if (overrideRes.rows.length > 0) return today();
  }

  const res = await query(
    `SELECT locked_through_date FROM entities WHERE id=$1`,
    [entityId]
  );
  const lockedThrough: string | null = res.rows[0]?.locked_through_date
    ? new Date(res.rows[0].locked_through_date).toISOString().split('T')[0]
    : null;

  return lockedThrough ? dayAfter(lockedThrough) : today();
}

/**
 * Lock a period. Advances locked_through_date if toDate is later than current value.
 * Always records a lock event.
 */
export async function lockPeriod(
  entityId: string,
  userId: string,
  lockType: 'vat_filing' | 'manual_year_end',
  fromDate: string,
  toDate: string,
  reason?: string
): Promise<void> {
  await query(
    `UPDATE entities
     SET locked_through_date = GREATEST(locked_through_date, $1::date), updated_at = NOW()
     WHERE id=$2`,
    [toDate, entityId]
  );
  await query(
    `INSERT INTO acc_period_lock_events (entity_id, locked_by, lock_type, from_date, to_date, reason)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [entityId, userId, lockType, fromDate, toDate, reason || null]
  );
}

/** Remove lock entirely. Records an unlock event. */
export async function unlockPeriod(entityId: string, userId: string): Promise<void> {
  const res = await query(`SELECT locked_through_date FROM entities WHERE id=$1`, [entityId]);
  const current = res.rows[0]?.locked_through_date;
  if (!current) return; // nothing to unlock

  await query(
    `UPDATE entities SET locked_through_date = NULL, updated_at = NOW() WHERE id=$1`,
    [entityId]
  );
  await query(
    `INSERT INTO acc_period_lock_events (entity_id, locked_by, lock_type, from_date, to_date, reason)
     VALUES ($1,$2,'unlock',$3,$3,'Manual unlock')`,
    [entityId, userId, new Date(current).toISOString().split('T')[0]]
  );
}

export async function getLockHistory(entityId: string): Promise<PeriodLockEvent[]> {
  const res = await query(
    `SELECT ple.id, ple.lock_type, ple.from_date, ple.to_date, ple.reason, ple.created_at,
            COALESCE(u.full_name, u.email) as locked_by_name
     FROM acc_period_lock_events ple
     JOIN users u ON ple.locked_by = u.id
     WHERE ple.entity_id=$1
     ORDER BY ple.created_at DESC`,
    [entityId]
  );
  return res.rows;
}

/** Grant a named user posting access into locked periods until a given time */
export async function grantOverride(
  entityId: string,
  userId: string,
  grantedBy: string,
  overrideUntil: Date
): Promise<void> {
  await query(
    `INSERT INTO acc_period_overrides (entity_id, user_id, granted_by, override_until)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (entity_id, user_id)
     DO UPDATE SET granted_by=$3, override_until=$4, created_at=NOW()`,
    [entityId, userId, grantedBy, overrideUntil.toISOString()]
  );
}

export async function revokeOverride(entityId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM acc_period_overrides WHERE entity_id=$1 AND user_id=$2`,
    [entityId, userId]
  );
}

export async function getActiveOverrides(entityId: string): Promise<PeriodOverride[]> {
  const res = await query(
    `SELECT po.id, po.user_id, po.override_until, po.created_at,
            COALESCE(u.full_name, u.email) as user_name,
            COALESCE(g.full_name, g.email) as granted_by_name
     FROM acc_period_overrides po
     JOIN users u ON po.user_id = u.id
     JOIN users g ON po.granted_by = g.id
     WHERE po.entity_id=$1 AND po.override_until > NOW()
     ORDER BY po.created_at DESC`,
    [entityId]
  );
  return res.rows;
}

export async function hasOverride(entityId: string, userId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM acc_period_overrides
     WHERE entity_id=$1 AND user_id=$2 AND override_until > NOW()`,
    [entityId, userId]
  );
  return res.rows.length > 0;
}
