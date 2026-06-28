import { useTrialRun } from "@/features/trials/TrialRunProvider"

/** "Mission A", "Mission B", ... from the zero-based mission index. */
function missionLabel(index: number): string {
  return `Mission ${String.fromCharCode(65 + index)}`
}

/**
 * The persistent trial chrome: title, the current mission and step, and a quiet
 * "Saved" marker. Presentational; reads the run straight from `useTrialRun`.
 */
export function TrialTopBar() {
  const { spec, state } = useTrialRun()
  const mission = spec.missions[state.missionIndex]
  const step = state.segmentIndex + 1

  return (
    <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-4 py-2.5 shadow-soft backdrop-blur">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {spec.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {missionLabel(state.missionIndex)} · Step {step} of{" "}
          {mission.segments.length}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success-foreground">
        <span className="size-1.5 rounded-full bg-success" />
        Saved
      </span>
    </header>
  )
}
