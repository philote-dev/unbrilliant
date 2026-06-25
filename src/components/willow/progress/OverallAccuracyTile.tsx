import type { AccuracyVM } from "./types"

import { MetricCard } from "./MetricCard"
import { StatNumber } from "./StatNumber"

/**
 * Headline accuracy: the share of attempted answers that were correct. With no
 * attempts there is nothing to divide, so we show a muted placeholder rather
 * than a NaN percentage.
 */
export function OverallAccuracyTile({ correct, attempted }: AccuracyVM) {
  if (attempted === 0) {
    return (
      <MetricCard>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">
            Overall accuracy
          </span>
          <span className="mt-1.5 text-sm text-faint">No answers yet</span>
        </div>
      </MetricCard>
    )
  }

  const pct = Math.round((correct / attempted) * 100)

  return (
    <MetricCard>
      <StatNumber
        value={`${pct}%`}
        label="Overall accuracy"
        sublabel={`${correct}/${attempted} correct`}
      />
    </MetricCard>
  )
}
