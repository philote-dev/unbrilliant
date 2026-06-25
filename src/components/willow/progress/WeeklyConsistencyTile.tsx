import type { WeeklyConsistencyVM } from "./types"

import { cn } from "@/lib/utils"
import { MetricCard } from "./MetricCard"
import { Ring } from "./Ring"

/**
 * Days active this week as a ring out of seven, with a dot per weekday beneath.
 * Empty data leaves the ring at zero and all seven dots muted.
 */
// COSTLY (Stage 2): needs per-day activity.
export function WeeklyConsistencyTile({ daysActive }: WeeklyConsistencyVM) {
  const active = Number.isFinite(daysActive)
    ? Math.max(0, Math.min(7, Math.floor(daysActive)))
    : 0

  return (
    <MetricCard title="This week">
      <div className="flex flex-col items-center gap-3">
        <Ring value={active} max={7}>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {active}/7
          </span>
        </Ring>
        <div className="flex items-center gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-2.5 rounded-full",
                i < active ? "bg-lilac-strong" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>
    </MetricCard>
  )
}
