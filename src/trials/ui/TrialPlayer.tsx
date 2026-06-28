import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTrialRun } from "@/features/trials/TrialRunProvider"
import { currentSegment } from "@/features/trials/trialModule"
import type { Verdict } from "@/features/trials/types"

import { DesignBoard } from "./DesignBoard"
import { TrialGate } from "./TrialGate"
import { TrialTopBar } from "./TrialTopBar"

/**
 * Orchestrates one Trial run on the B/A hybrid surface: the immersive gate until
 * the learner begins, then a stacked working surface (top bar, client scene,
 * phase content). The client scene and stress-test animation are placeholders
 * here; the rich figures slot into the same seams in the next update.
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
        {state.phase === "design" && <DesignBoard />}
        {state.phase === "verdict" && <VerdictPanel />}
        {state.phase === "complete" && <CompletePanel />}
      </div>
    </div>
  )
}

/**
 * Placeholder for the animated Client Scene. Shows the segment's client prompt as
 * a titled brief; the real-world animated figure replaces the body next update.
 */
function ClientScene({ prompt, skin }: { prompt: string; skin: string }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-lilac-soft text-lilac-strong">
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 20a8 8 0 0 1 16 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-lilac-strong">
          The client
        </h2>
      </div>
      <p className="mt-3 text-base leading-relaxed text-foreground">{prompt}</p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{skin}</p>
    </section>
  )
}

const VERDICT_TONE: Record<
  Verdict,
  { label: string; panel: string; accent: string }
> = {
  viable: {
    label: "Viable",
    panel: "border-success/50 bg-success-soft",
    accent: "text-success-foreground",
  },
  strained: {
    label: "Strained",
    panel: "border-warning/60 bg-warning-soft",
    accent: "text-warning-foreground",
  },
  broken: {
    label: "Broken",
    panel: "border-danger/60 bg-danger-soft",
    accent: "text-danger-foreground",
  },
}

/**
 * Basic verdict panel: the classifier's status, the segment's authored
 * explanation, and the forgiving recovery controls. Broken must revise; strained
 * may continue or revise; viable continues. The animated stress test lands next.
 */
function VerdictPanel() {
  const { state, dispatch } = useTrialRun()
  const reduce = useReducedMotion()
  const segment = currentSegment(state)
  const verdict = state.verdict
  if (!verdict) return null

  const status = verdict.status
  const tone = VERDICT_TONE[status]
  const nudge = verdict.nudgeId ? segment.nudges[verdict.nudgeId] : undefined

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-3xl border p-5 shadow-card", tone.panel)}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          tone.accent,
        )}
      >
        Stress test: {tone.label}
      </p>
      <p className="mt-2 text-base leading-relaxed text-foreground">
        {segment.explanations[status]}
      </p>
      {nudge && status !== "viable" && (
        <p className="mt-3 rounded-xl bg-card/70 p-3 text-sm leading-relaxed text-muted-foreground">
          {nudge}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {status === "broken" && (
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "revise" })}
          >
            Revise the design
          </Button>
        )}
        {status === "strained" && (
          <>
            <Button
              variant="tactile"
              size="lg"
              className="w-full"
              onClick={() => dispatch({ type: "advance" })}
            >
              Continue anyway
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => dispatch({ type: "revise" })}
            >
              Revise the design
            </Button>
          </>
        )}
        {status === "viable" && (
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "advance" })}
          >
            Continue
          </Button>
        )}
      </div>
    </motion.section>
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
