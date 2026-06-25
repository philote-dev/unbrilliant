// COSTLY (Stage 2): needs per-session accuracy history.
import type { SeriesVM } from "./types"

import { MetricCard } from "./MetricCard"
import { Sparkline } from "./Sparkline"

/**
 * Accuracy across recent sessions as a trend line. Points are 0..1 fractions and
 * the caption surfaces the most recent value as a percentage. With no points
 * there is nothing to plot, so we show a muted placeholder instead.
 */
export function AccuracyTrendTile({ points }: SeriesVM) {
  if (points.length === 0) {
    return (
      <MetricCard title="Accuracy trend">
        <span className="text-sm text-faint">Not enough data</span>
      </MetricCard>
    )
  }

  const latest = Math.round(points[points.length - 1] * 100)

  return (
    <MetricCard title="Accuracy trend">
      <Sparkline points={points} mode="line" />
      <p className="mt-2 text-xs text-faint tabular-nums">Latest {latest}%</p>
    </MetricCard>
  )
}
