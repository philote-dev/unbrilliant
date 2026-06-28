import type { FlameTier } from "../Flame"
import type { StreakVM } from "./types"

import { Flame } from "../Flame"
import { MetricCard } from "./MetricCard"

/**
 * Day-streak flame tier. Any live run lights a flame (a one-day streak is already
 * worth a spark), and it climbs as the run grows: spark at 1-2, droplet at 3-6,
 * blaze at 7-13, inferno at 14+. Streaks count days, so this is tuned separately
 * from the lesson-combo tiers in Flame.tsx.
 */
function streakTier(current: number): FlameTier {
  if (current < 1) return 0
  if (current < 3) return 1
  if (current < 7) return 2
  if (current < 14) return 3
  return 4
}

function StreakStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl font-bold tabular-nums leading-none text-foreground">{value}</span>
      <span className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * Current vs longest streak, led by the flame whose tier tracks the live run. The
 * flame and the numbers are centered in the tile; with no streak yet the flame is
 * unlit above a nudge to begin.
 */
export function StreakTile({ current, longest }: StreakVM) {
  const tier = streakTier(current)
  const empty = current === 0 && longest === 0

  return (
    <MetricCard title="Streak">
      <div className="flex flex-col items-center gap-3 text-center">
        <Flame tier={tier} size={56} />
        {empty ? (
          <span className="text-sm text-faint">Start a streak</span>
        ) : (
          <div className="flex items-stretch justify-center gap-5">
            <StreakStat value={current} label="Current" />
            <div className="w-px shrink-0 bg-border" />
            <StreakStat value={longest} label="Longest" />
          </div>
        )}
      </div>
    </MetricCard>
  )
}
