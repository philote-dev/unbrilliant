import type { MasteryVM } from "./types"

import { MetricCard } from "./MetricCard"
import { Ring } from "./Ring"

/**
 * Overall mastery as a percentage ring. `mastery` is a 0..1 fraction, so we
 * scale it onto the ring's 0..100 range (Ring defaults to max=1, hence the
 * explicit max). Zero mastery leaves the ring empty.
 */
export function OverallMasteryTile({ mastery }: MasteryVM) {
  const pct = Math.round(mastery * 100)

  return (
    <MetricCard>
      <div className="flex flex-col items-center gap-3">
        <Ring value={mastery * 100} max={100}>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {pct}%
          </span>
        </Ring>
        <span className="text-sm font-medium text-muted-foreground">
          Overall mastery
        </span>
      </div>
    </MetricCard>
  )
}
