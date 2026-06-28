import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SegmentSpec, StructureKind, Verdict } from "@/features/trials/types"

import { ConsequenceFigure } from "./trialFigures"

const VERDICT_TONE: Record<
  Verdict,
  { label: string; edge: string; panel: string; accent: string }
> = {
  viable: {
    label: "Viable",
    edge: "border-success/50",
    panel: "border-success/50 bg-success-soft",
    accent: "text-success-foreground",
  },
  strained: {
    label: "Strained",
    edge: "border-warning/60",
    panel: "border-warning/60 bg-warning-soft",
    accent: "text-warning-foreground",
  },
  broken: {
    label: "Broken",
    edge: "border-danger/60",
    panel: "border-danger/60 bg-danger-soft",
    accent: "text-danger-foreground",
  },
}

/** A neutral, present-tense label for the operation being stress-tested. */
function attemptCaption(segmentId: string): string {
  switch (segmentId) {
    case "a1-intake":
      return "Serving from the front of the line"
    case "a2-cancellation":
      return "Removing the student in the middle"
    case "a3-undo":
      return "Undoing the most recent action"
    default:
      return "Running the stress test"
  }
}

/**
 * The Stress Test experience for the verdict phase. Presentational only: grading
 * already happened in the reducer, so this panel just dramatizes the consequence
 * and offers the forgiving recovery controls.
 *
 *  - A consequence animation appropriate to the structure + segment plays once,
 *    on entry (it is mounted only after Run, so it never leaks the answer early).
 *  - The verdict reads prominently in its feedback color: viable is calm green,
 *    strained amber, broken red (mirroring the index.css feedback tokens).
 *  - Controls follow the forgiving model: broken must revise; strained may
 *    continue (weakness logged) or revise; viable continues.
 *
 * Takes the verdict/segment as props so it stays trivially testable; the player
 * wires it from the live run.
 */
export function StressTestPanel({
  status,
  segment,
  structure,
  nudge,
  onContinue,
  onRevise,
}: {
  status: Verdict
  segment: SegmentSpec
  structure: StructureKind | null
  nudge?: string
  onContinue: () => void
  onRevise: () => void
}) {
  const reduce = useReducedMotion() ?? false
  const tone = VERDICT_TONE[status]

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-3xl border-2 bg-card p-5 shadow-card", tone.edge)}
    >
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30 px-3 py-6">
        <ConsequenceFigure
          structure={structure}
          segmentId={segment.id}
          status={status}
          reduce={reduce}
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {attemptCaption(segment.id)}
        </p>
      </div>

      <div className={cn("mt-4 rounded-2xl border p-4", tone.panel)}>
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
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {status === "broken" && (
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={onRevise}
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
              onClick={onContinue}
            >
              Continue anyway
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onRevise}
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
            onClick={onContinue}
          >
            Continue
          </Button>
        )}
      </div>
    </motion.section>
  )
}
