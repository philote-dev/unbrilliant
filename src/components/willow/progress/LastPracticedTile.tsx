// CHEAP (Stage 2): one timestamp per learner.
import type { LastPracticedVM } from "./types"

import { MetricCard } from "./MetricCard"

/**
 * How long since the learner last practiced, as a whole-day relative phrase.
 * `now` is injectable so rendering stays deterministic. With no recorded
 * timestamp we show a muted placeholder rather than computing against null.
 */
export function LastPracticedTile({
  at,
  now = Date.now(),
}: LastPracticedVM & { now?: number }) {
  if (at === null) {
    return (
      <MetricCard title="Last practiced">
        <span className="text-sm text-faint">Not practiced yet</span>
      </MetricCard>
    )
  }

  const days = Math.floor((now - at) / 86400000)
  const phrase =
    days <= 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`

  return (
    <MetricCard title="Last practiced">
      <span className="text-2xl font-bold tabular-nums text-foreground">
        {phrase}
      </span>
    </MetricCard>
  )
}
