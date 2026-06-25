// COSTLY (Stage 2): needs per-day answer counts.
import type { VolumeVM } from "./types"

import { MetricCard } from "./MetricCard"
import { MiniBars } from "./MiniBars"

/**
 * Answer volume per day as a compact bar chart. The caption totals the window so
 * a glance gives both the shape and the sum. With no days, or only empty days,
 * we show a muted placeholder and never divide into an empty window.
 */
export function AnswersPerDayTile({ values }: VolumeVM) {
  const sum = values.reduce((total, v) => total + v, 0)
  const empty = values.length === 0 || sum === 0

  if (empty) {
    return (
      <MetricCard title="Answers per day">
        <span className="text-sm text-faint">No answers yet</span>
      </MetricCard>
    )
  }

  return (
    <MetricCard title="Answers per day">
      <MiniBars values={values} />
      <p className="mt-2 text-xs text-faint tabular-nums">
        {sum} answers / {values.length}d
      </p>
    </MetricCard>
  )
}
