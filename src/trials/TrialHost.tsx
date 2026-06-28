import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  TrialRunProvider,
  useTrialRun,
} from "@/features/trials/TrialRunProvider"
import { currentSegment } from "@/features/trials/trialModule"
import { useNavigation } from "@/lib/navigation"

import { getTrial } from "./registry"

// Stable no-op so TrialRunProvider's autosave/completion effect deps don't churn
// each render. The real clean-pass mastery boost is wired into completion in a
// later phase; for now the host just needs the run to mount.
const noop = () => {}

/**
 * Routes a trialId to its run, mirroring `LessonHost`: a thin shell that resolves
 * the registry singleton spec and mounts the provider, with no grading of its
 * own. The body here is a placeholder, replaced by the real `TrialPlayer` in
 * Phase 3. Not yet reachable from navigation: the `navigation.tsx` / `App.tsx`
 * route is deferred behind unrelated in-flight work.
 */
export function TrialHost({ trialId }: { trialId: string }) {
  const spec = getTrial(trialId)

  if (!spec) {
    return <TrialNotFound trialId={trialId} />
  }

  return (
    <TrialRunProvider spec={spec} onTrialComplete={noop}>
      <TrialPlaceholder />
    </TrialRunProvider>
  )
}

function TrialNotFound({ trialId }: { trialId: string }) {
  const { back } = useNavigation()
  return (
    <CenteredCard>
      <h1 className="text-lg font-semibold text-foreground">Trial not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No trial is registered for{" "}
        <span className="font-mono text-foreground">{trialId}</span>.
      </p>
      <Button variant="soft" className="mt-5" onClick={back}>
        Go back
      </Button>
    </CenteredCard>
  )
}

/**
 * Minimal presentational stand-in for the Phase 3 `TrialPlayer`. Reads the run
 * through `useTrialRun` so it stays honest about where the engine currently is.
 */
function TrialPlaceholder() {
  const { spec, state } = useTrialRun()
  const mission = spec.missions[state.missionIndex]
  const segment = currentSegment(state)

  return (
    <CenteredCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-lilac-strong">
        {spec.title}
      </p>
      <h1 className="mt-2 text-lg font-semibold text-foreground">
        Trial player arrives in the next phase
      </h1>
      <dl className="mt-4 space-y-1 text-sm text-muted-foreground">
        <div>
          mission: <span className="font-mono text-foreground">{mission.id}</span>
        </div>
        <div>
          segment: <span className="font-mono text-foreground">{segment.id}</span>
        </div>
      </dl>
    </CenteredCard>
  )
}

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        {children}
      </div>
    </div>
  )
}
