// COSTLY (Stage 2): needs per-day activity history, not yet persisted.
import type { HeatmapVM } from "./types"

import { HeatmapGrid } from "./HeatmapGrid"
import { MetricCard } from "./MetricCard"

/**
 * Daily activity as a GitHub-style heatmap. The grid renders empty and zero
 * cells gracefully, so with no recorded activity we still show the faint grid
 * and add a muted caption rather than collapsing the tile.
 */
export function ActivityHeatmapTile({ weeks }: HeatmapVM) {
  const empty = weeks.every((week) => week.every((day) => day <= 0))

  return (
    <MetricCard title="Activity">
      <HeatmapGrid weeks={weeks} />
      {empty ? <p className="mt-3 text-xs text-faint">No activity yet</p> : null}
    </MetricCard>
  )
}
