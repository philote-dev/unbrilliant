import type { LifetimeVM } from "./types"

import { MetricCard } from "./MetricCard"
import { StatNumber, StatPair } from "./StatNumber"

/**
 * Lifetime answer counts as attempted vs correct. Before any practice both
 * sides read zero, with a muted caption so the empty tile still makes sense at
 * a glance.
 */
export function LifetimeTotalsTile({ attempted, correct }: LifetimeVM) {
  const empty = attempted === 0 && correct === 0

  return (
    <MetricCard title="Lifetime totals">
      <StatPair
        left={<StatNumber value={attempted} label="Attempted" />}
        right={<StatNumber value={correct} label="Correct" />}
      />
      {empty ? (
        <p className="mt-3 text-xs text-faint">No answers logged yet</p>
      ) : null}
    </MetricCard>
  )
}
