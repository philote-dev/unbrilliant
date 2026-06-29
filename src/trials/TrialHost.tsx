import { useCallback, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { TrialRunProvider } from "@/features/trials/TrialRunProvider"
import type { TrialSpec } from "@/features/trials/types"
import { useNavigation } from "@/lib/navigation"

import { getTrial } from "./registry"
import { TrialPlayer } from "./ui/TrialPlayer"

/**
 * Routes a trialId to its run, mirroring `LessonHost`: resolve the registry
 * singleton spec, mount the run provider, and render the player. On completion it
 * promotes each exercised concept once (the clean-pass-scaled mastery boost),
 * routed through the concept-review write path. Anonymous runs no-op the boost.
 */
export function TrialHost({ trialId }: { trialId: string }) {
  const spec = getTrial(trialId)
  const { reinforce } = useConceptReviews()

  const onTrialComplete = useCallback(
    (completed: TrialSpec, cleanPass: boolean) => {
      for (const conceptId of completed.exercisedConcepts) {
        reinforce(conceptId, cleanPass)
      }
    },
    [reinforce],
  )

  if (!spec) {
    return <TrialNotFound trialId={trialId} />
  }

  return (
    <TrialRunProvider spec={spec} onTrialComplete={onTrialComplete}>
      <TrialPlayer />
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

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        {children}
      </div>
    </div>
  )
}
