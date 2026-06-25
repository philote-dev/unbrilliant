// COSTLY (Stage 2): needs per-day activity history (a year of daily counts).
import type { ContributionsVM } from "./types"

import { MetricCard } from "./MetricCard"
import { ContributionCalendar } from "./ContributionCalendar"

/**
 * GitHub-style year-in-days calendar. Empty (no days, or every day zero) keeps
 * the faint full-year grid and swaps the summary for a muted "No activity yet".
 */
export function ContributionCalendarTile({ days }: ContributionsVM) {
  const total = days.reduce((sum, d) => (d.count > 0 ? sum + d.count : sum), 0)
  const empty = days.length === 0 || total === 0

  return (
    <MetricCard title="Contribution calendar">
      <ContributionCalendar days={days} />
      <p className="mt-3 text-xs tabular-nums text-muted-foreground">
        {empty ? "No activity yet" : `${total} answers in the last year`}
      </p>
    </MetricCard>
  )
}
