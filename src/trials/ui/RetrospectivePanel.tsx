import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useTrialRun } from "@/features/trials/TrialRunProvider"

/**
 * The completion retrospective: a calm, non-scored close to the Trial. It shows
 * what the learner's designs taught them (the spec's retrospective copy) and a
 * clean-pass-scaled mastery note. The actual concept boost is applied by the host
 * on completion; this panel only reflects it. Presentational and navigation-free
 * so it renders in the dev lab as well as the app.
 */
export function RetrospectivePanel() {
  const { spec, state } = useTrialRun()
  const reduce = useReducedMotion() ?? false
  const clean = state.cleanPass
  const revisions = state.revisionHistory.length

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
    >
      <div className="bg-gradient-to-br from-primary/15 to-primary/5 px-6 py-7 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop">
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5 10 17l9-10" />
          </svg>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Trial conquered
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{spec.title}</h2>
      </div>

      <div className="space-y-4 p-6">
        {spec.retrospective && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What you discovered
            </p>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              {spec.retrospective}
            </p>
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl border p-4",
            clean ? "border-success/50 bg-success-soft" : "border-primary/40 bg-primary/5",
          )}
        >
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              clean ? "text-success-foreground" : "text-primary",
            )}
          >
            {clean ? "Clean run" : "Mastery refreshed"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {clean
              ? "You designed every system soundly on the first try. Your sense of linear structures climbed a level."
              : "You worked through every system, revising until it held. Your sense of linear structures is strong and fresh again."}
          </p>
        </div>

        {revisions > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            You reworked your design {revisions} {revisions === 1 ? "time" : "times"} to
            get here. That is how real design works.
          </p>
        )}
      </div>
    </motion.section>
  )
}
