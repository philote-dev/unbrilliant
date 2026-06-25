import type { StreakVM } from "./types"

import { Flame, comboToTier } from "../Flame"
import { MetricCard } from "./MetricCard"
import { StatNumber, StatPair } from "./StatNumber"

/**
 * Current vs longest streak, paired with the shared flame whose tier tracks the
 * current run. With no streak yet we show an unlit flame and a nudge to begin.
 */
export function StreakTile({ current, longest }: StreakVM) {
  const tier = comboToTier(current)
  const empty = current === 0 && longest === 0

  return (
    <MetricCard title="Streak">
      <div className="flex items-center gap-4">
        <Flame tier={tier} size={44} />
        {empty ? (
          <span className="text-sm text-faint">Start a streak</span>
        ) : (
          <div className="flex-1">
            <StatPair
              left={<StatNumber value={current} label="Current" />}
              right={<StatNumber value={longest} label="Longest" />}
            />
          </div>
        )}
      </div>
    </MetricCard>
  )
}
