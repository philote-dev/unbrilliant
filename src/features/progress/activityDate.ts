/**
 * Local-day helpers for the activity log. Everything buckets by the learner's
 * LOCAL calendar day so the contribution calendar, "this week", answers-per-day,
 * and accuracy growth all agree on day boundaries. Day windows iterate via the
 * Date constructor (never by adding 86_400_000) so they stay correct across DST.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** The "yyyymmdd" key for the local calendar day containing `ts` (epoch ms). */
export function localDayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

/**
 * The UTC-midnight epoch ms for a "yyyymmdd" key. The contribution calendar
 * reads this epoch with getUTC* accessors, so encoding the local Y/M/D as a UTC
 * midnight keeps its weekday and month labels correct in any viewer timezone.
 */
export function dayKeyToUTCDate(dayKey: string): number {
  const y = Number(dayKey.slice(0, 4))
  const m = Number(dayKey.slice(4, 6))
  const d = Number(dayKey.slice(6, 8))
  return Date.UTC(y, m - 1, d)
}

/** Inverse of `dayKeyToUTCDate`: the "yyyymmdd" key for an `ActivityDay.date`. */
export function utcDateToDayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

/** The `n` local day keys ending on the day of `now`, oldest to newest. */
export function lastNDayKeys(now: number, n: number): string[] {
  const base = new Date(now)
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    keys.push(localDayKey(d.getTime()))
  }
  return keys
}

/**
 * The current local week (Monday to Sunday) containing `now`, as inclusive day
 * keys. Monday is treated as the first day of the week.
 */
export function localWeekRange(now: number): { startKey: string; endKey: string } {
  const d = new Date(now)
  const mondayOffset = (d.getDay() + 6) % 7 // getDay(): 0=Sun..6=Sat -> 0=Mon..6=Sun
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset)
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset + 6)
  return {
    startKey: localDayKey(monday.getTime()),
    endKey: localDayKey(sunday.getTime()),
  }
}
