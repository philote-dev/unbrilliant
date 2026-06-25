import type { PersonalBestsVM } from "./types"

import { MetricCard } from "./MetricCard"
import { StatNumber } from "./StatNumber"

/**
 * Personal records: best streak, best single-lesson accuracy, and busiest day.
 * Empty data reads as zeros, with the best-day slot showing a dash until any
 * day history exists.
 */
// bestDayCount is COSTLY (Stage 2): needs per-day history; streak+accuracy are FREE.
export function PersonalBestsTile({
  bestStreak,
  bestLessonAccuracy,
  bestDayCount,
}: PersonalBestsVM) {
  const streak = Number.isFinite(bestStreak) ? bestStreak : 0
  const accuracyPct = Number.isFinite(bestLessonAccuracy)
    ? Math.round(Math.max(0, Math.min(1, bestLessonAccuracy)) * 100)
    : 0
  const bestDay = bestDayCount === null ? "-" : String(bestDayCount)

  return (
    <MetricCard title="Personal bests">
      <div className="grid grid-cols-3 gap-3">
        <StatNumber value={streak} label="Best streak" />
        <StatNumber value={`${accuracyPct}%`} label="Best accuracy" />
        <StatNumber value={bestDay} label="Best day" />
      </div>
    </MetricCard>
  )
}
