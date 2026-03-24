export interface PeriodLockedError {
  lockedThrough: string;
  reason: string | null;
  earliestUnlockedDate: string;
}

export async function parsePeriodLockedResponse(res: Response): Promise<PeriodLockedError | null> {
  if (res.status !== 403) return null;
  try {
    const body = await res.clone().json();
    if (body.error === 'PERIOD_LOCKED') {
      return {
        lockedThrough: body.lockedThrough,
        reason: body.reason,
        earliestUnlockedDate: body.earliestUnlockedDate,
      };
    }
  } catch {}
  return null;
}
