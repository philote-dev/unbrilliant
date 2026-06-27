import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { appendRun } from "@/features/lesson/arraysEngine"
import { CopyGrow } from "./CapacityFrame"
import { useReplayCycle } from "./useReplayCycle"
import { SUMMARY_REVEAL } from "./summaryReveal"

/**
 * The average-cost summary figure (beat 11). It shows the same grow choreography
 * from the previous beat, twice and side by side: doubling (a big block, so the
 * copy is rare) next to grow-by-one (a barely-bigger block that fills again at
 * once). The page reveals top to bottom: the learner reads the title, then each
 * column cascades in (its label, the full block, the arrow, then the slow copy) on
 * one shared cycle so the two tactics play in sync, and finally each total settles
 * beneath its block. The totals over a run of 8 appends are 7 (doubling) vs 28
 * (grow-by-one), from the pure `appendRun` helper, so they are deterministic and
 * unit-tested. Reduced motion holds it at rest. Pure and view-only.
 */
const APPENDS = 8
const SUMMARY_SLOT = 18
const ITEMS = ["A", "B", "C", "D"]
const SLOW_STAGGER = 0.18 // a slower copy, for visualization

export function GrowSummary({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const doubling = appendRun(APPENDS, "double")
  const plusOne = appendRun(APPENDS, "plusOne")
  // One shared cycle drives both columns, so the two copies stay in lockstep.
  const cycle = useReplayCycle(!isReduced, 5200)

  return (
    <div className="flex w-full items-start justify-center gap-6" data-testid="grow-summary">
      <SummaryColumn
        title="Double the block"
        newCapacity={ITEMS.length * 2}
        newLabel="…to 8"
        cycle={cycle}
        reduced={isReduced}
        total={doubling.totalCopied}
        blurb="copies stay rare"
        tone="good"
      />
      <SummaryColumn
        title="Grow by one"
        newCapacity={ITEMS.length + 1}
        newLabel="…to 5"
        cycle={cycle}
        reduced={isReduced}
        total={plusOne.totalCopied}
        blurb="copies pile up"
        tone="bad"
      />
    </div>
  )
}

function SummaryColumn({
  title,
  newCapacity,
  newLabel,
  cycle,
  reduced,
  total,
  blurb,
  tone,
}: {
  title: string
  newCapacity: number
  newLabel: string
  cycle: number
  reduced: boolean
  total: number
  blurb: string
  tone: "good" | "bad"
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.span
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { delay: SUMMARY_REVEAL.colTitle }}
      >
        {title}
      </motion.span>
      <CopyGrow
        items={ITEMS}
        newCapacity={newCapacity}
        oldLabel="Full"
        newLabel={newLabel}
        slot={SUMMARY_SLOT}
        reduced={reduced}
        cycle={cycle}
        baseDelay={SUMMARY_REVEAL.oldBlock}
        stagger={SLOW_STAGGER}
      />
      <motion.div
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2",
          tone === "good"
            ? "border-success/40 bg-success-soft/40"
            : "border-danger/40 bg-danger-soft/40",
        )}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { delay: SUMMARY_REVEAL.total }}
      >
        <span
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "good" ? "text-success" : "text-danger",
          )}
        >
          {total} copies
        </span>
        <span className="text-xs text-muted-foreground">{blurb}</span>
      </motion.div>
    </div>
  )
}
