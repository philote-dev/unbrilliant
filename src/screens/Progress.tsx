import { useProgressMetrics } from "@/features/progress/progressMetrics"
import { ProgressDashboard } from "@/screens/ProgressDashboard"

/**
 * The Progress tab: a personal-progression dashboard (streaks, consistency,
 * growth) across two tabs. Real numbers come from `useProgressMetrics`; the
 * dashboard itself is presentational, so it also renders from gallery fixtures.
 */
export function Progress() {
  const metrics = useProgressMetrics()
  return <ProgressDashboard metrics={metrics} />
}
