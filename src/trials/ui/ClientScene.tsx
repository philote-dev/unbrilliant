import { motion, useReducedMotion } from "motion/react"

import { useTrialRun } from "@/features/trials/TrialRunProvider"

import { STRUCTURE_META } from "./StructurePalette"
import { StructureFigure } from "./trialFigures"

/**
 * The Client Scene: the real-world brief on top of the working surface. It always
 * shows the client's request, and once a structure is chosen (in the design
 * phase) it renders that structure as a live figure so the learner sees their
 * design as a concrete line/pile/chain.
 *
 * It reads engine state only and is deliberately calm: no consequence plays here,
 * so the scene can never leak a verdict before the learner runs the stress test
 * (the post-Run animation lives in the StressTestPanel). During the verdict phase
 * the figure steps aside so that stress-test animation is the single focus.
 */
export function ClientScene({ prompt, skin }: { prompt: string; skin: string }) {
  const { state } = useTrialRun()
  const reduce = useReducedMotion() ?? false
  const structure = state.structure
  const showFigure = structure != null && state.phase === "design"

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

      {showFigure && structure && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 rounded-2xl border border-border bg-background px-3 py-5"
        >
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Your {STRUCTURE_META[structure].label.toLowerCase()}
          </p>
          <StructureFigure structure={structure} reduce={reduce} />
        </motion.div>
      )}
    </section>
  )
}
