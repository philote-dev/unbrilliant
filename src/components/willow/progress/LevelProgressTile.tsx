import type { LevelVM } from "./types"

import { ProgressBar } from "../Progress"
import { MetricCard } from "./MetricCard"

/**
 * Lifetime level derived from total correct answers: every `xpPerLevel` correct
 * answers earns a level, and the bar shows progress into the current one. With
 * no answers yet this sits at Level 1 with an empty bar.
 */
export function LevelProgressTile({ totalCorrect, xpPerLevel = 100 }: LevelVM) {
  const perLevel = Number.isFinite(xpPerLevel) && xpPerLevel > 0 ? xpPerLevel : 100
  const total = Number.isFinite(totalCorrect) && totalCorrect > 0 ? Math.floor(totalCorrect) : 0
  const level = Math.floor(total / perLevel) + 1
  const into = total % perLevel

  return (
    <MetricCard>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-foreground">
            Level <span className="tabular-nums">{level}</span>
          </span>
          <span className="text-xs tabular-nums text-faint">{into}/{perLevel} XP</span>
        </div>
        <ProgressBar value={(into / perLevel) * 100} />
      </div>
    </MetricCard>
  )
}
