// COSTLY (Stage 2): needs mastery snapshots over time.
import type { SeriesVM } from "./types"

import { MetricCard } from "./MetricCard"
import { Sparkline } from "./Sparkline"

/**
 * Cumulative mastery growth as a filled area. Points are 0..1 fractions that
 * climb over time, and the caption shows the latest value as a percentage. With
 * no points yet we show a muted placeholder instead of an empty chart.
 */
export function MasteryGrowthTile({ points }: SeriesVM) {
  if (points.length === 0) {
    return (
      <MetricCard title="Mastery growth">
        <span className="text-sm text-faint">Not enough data</span>
      </MetricCard>
    )
  }

  const latest = Math.round(points[points.length - 1] * 100)

  return (
    <MetricCard title="Mastery growth">
      <Sparkline points={points} mode="area" />
      <p className="mt-2 text-xs text-faint tabular-nums">Latest {latest}%</p>
    </MetricCard>
  )
}
