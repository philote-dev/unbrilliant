import type { LessonsMasteredVM } from "./types"

import { MetricCard } from "./MetricCard"
import { Ring } from "./Ring"

/**
 * Lessons mastered out of the total, drawn as a ring with the raw count at its
 * center. With nothing completed the ring simply sits empty at zero.
 */
export function LessonsMasteredTile({ completed, total }: LessonsMasteredVM) {
  return (
    <MetricCard>
      <div className="flex flex-col items-center gap-3">
        <Ring value={completed} max={total}>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {completed}/{total}
          </span>
        </Ring>
        <span className="text-sm font-medium text-muted-foreground">
          Lessons mastered
        </span>
      </div>
    </MetricCard>
  )
}
