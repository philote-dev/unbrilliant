import { useState } from "react"

import { useTrialRun } from "@/features/trials/TrialRunProvider"
import { currentSegment } from "@/features/trials/trialModule"

import { ClientScene } from "./ClientScene"
import { DesignBoard } from "./DesignBoard"
import { PredictionReview } from "./PredictionReview"
import { StressTestPanel } from "./StressTestPanel"
import { TrialGate } from "./TrialGate"
import { TrialTopBar } from "./TrialTopBar"

/**
 * Orchestrates one Trial run on the B/A hybrid surface: the immersive gate until
 * the learner begins, then a stacked working surface (top bar, client scene,
 * phase content). The client scene renders the chosen structure as a live figure;
 * the stress-test phase swaps in the consequence animation + verdict.
 */
export function TrialPlayer() {
  const { spec, state } = useTrialRun()
  const [begun, setBegun] = useState(false)
  const segment = currentSegment(state)
  const mission = spec.missions[state.missionIndex]

  if (!begun) {
    return <TrialGate title={spec.title} onBegin={() => setBegun(true)} />
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-5">
        <TrialTopBar />
        <ClientScene prompt={segment.clientPrompt} skin={mission.clientSkin} />
        {state.phase === "complete" ? (
          <CompletePanel />
        ) : segment.grading === "prediction" ? (
          // Final-review segments own both their design (predict) and verdict
          // (replay) phases; the capability board/panel handle every other segment.
          <PredictionReview />
        ) : state.phase === "design" ? (
          <DesignBoard />
        ) : (
          <StressTest />
        )}
      </div>
    </div>
  )
}

/**
 * Wires the live verdict into the presentational {@link StressTestPanel}: the
 * classifier already ran in the reducer, so this only forwards the status, the
 * segment's authored copy, and the forgiving recovery actions.
 */
function StressTest() {
  const { state, dispatch } = useTrialRun()
  const segment = currentSegment(state)
  const verdict = state.verdict
  if (!verdict) return null

  const nudge = verdict.nudgeId ? segment.nudges[verdict.nudgeId] : undefined

  return (
    <StressTestPanel
      status={verdict.status}
      segment={segment}
      structure={state.structure}
      nudge={nudge}
      onContinue={() => dispatch({ type: "advance" })}
      onRevise={() => dispatch({ type: "revise" })}
    />
  )
}

/** Placeholder completion; the full retrospective + boost arrive later. */
function CompletePanel() {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-card">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success-foreground">
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12.5 10 17l9-10" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Trial complete
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        You worked through every segment. The full retrospective and mastery
        boost arrive in a later update.
      </p>
    </section>
  )
}
