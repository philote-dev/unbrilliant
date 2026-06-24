import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * A wordless "search space" meter for the BST descend: a row of `total` pips with
 * the already-discarded candidates extinguished, so each comparison visibly halves
 * what is left (7 -> 3 -> 1). It is purely PRESENTATIONAL and aria-hidden: the
 * meaning is announced by the figure's own role="status" line, which reports the
 * same `candidatesRemaining` count, so the two never disagree. This is a dedicated
 * component, NOT a CostReadout change. Reduced motion snaps the pip transitions.
 */
export function HalvingMeter({
  total,
  remaining,
  reducedMotion,
}: {
  total: number
  remaining: number
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const lit = Math.max(0, Math.min(total, remaining))
  const transition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 26 }

  return (
    <div
      data-testid="halving-meter"
      data-total={total}
      data-remaining={lit}
      data-reduced-motion={reduced ? "1" : undefined}
      aria-hidden
      className="flex flex-col items-center gap-1.5"
    >
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const on = i < lit
          return (
            <motion.span
              key={i}
              data-testid="halving-pip"
              data-on={on ? "1" : "0"}
              initial={false}
              animate={{ opacity: on ? 1 : 0.2, scale: on || reduced ? 1 : 0.7 }}
              transition={transition}
              className={cn("h-3 w-3 rounded-full", on ? "bg-lilac-strong" : "bg-muted")}
            />
          )
        })}
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-lilac-strong">
        {lit} in play
      </span>
    </div>
  )
}
