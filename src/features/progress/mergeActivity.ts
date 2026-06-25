import type { ActivityDay } from "@/features/progress/ProgressRepository"

/**
 * Sum two activity lists by day (`date`), returned ascending and deduped. Used to
 * overlay this session's in-memory deltas on the persisted log so "today" shows
 * instantly without a re-read.
 */
export function mergeActivity(a: ActivityDay[], b: ActivityDay[]): ActivityDay[] {
  const byDate = new Map<number, { attempted: number; correct: number }>()
  for (const d of a) addDay(byDate, d)
  for (const d of b) addDay(byDate, d)
  return [...byDate.entries()]
    .map(([date, v]) => ({ date, attempted: v.attempted, correct: v.correct }))
    .sort((x, y) => x.date - y.date)
}

function addDay(
  byDate: Map<number, { attempted: number; correct: number }>,
  d: ActivityDay,
): void {
  const prev = byDate.get(d.date) ?? { attempted: 0, correct: 0 }
  byDate.set(d.date, {
    attempted: prev.attempted + d.attempted,
    correct: prev.correct + d.correct,
  })
}
