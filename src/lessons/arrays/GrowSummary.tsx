import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { appendRun } from "@/features/lesson/arraysEngine"

/**
 * The average-cost summary figure (beat 11). It runs the same 8 appends two ways:
 * doubling (rare, growing copies) and grow-by-one (a copy almost every time), then
 * contrasts the running totals. Numbers come from the pure `appendRun` helper, so
 * they are deterministic and unit-tested. Reveal animates in; reduced motion shows
 * it at rest. Pure and view-only (no Big-O, no "amortization" wording).
 */
const APPENDS = 8

export function GrowSummary({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const doubling = appendRun(APPENDS, "double")
  const plusOne = appendRun(APPENDS, "plusOne")
  const copies = doubling.steps.filter((s) => s.grew).length

  return (
    <div className="flex flex-col items-center gap-6" data-testid="grow-summary">
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
          {doubling.steps.map((s, i) => (
            <motion.div
              key={s.n}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-bold",
                s.grew ? "bg-amber-200 text-amber-900" : "bg-lilac-soft text-foreground",
              )}
              initial={isReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={isReduced ? { duration: 0 } : { delay: i * 0.08 }}
              title={s.grew ? `copied ${s.copied}` : "just landed"}
            >
              {s.grew ? s.copied : ""}
            </motion.div>
          ))}
        </div>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          {APPENDS} appends, only {copies} had to copy. Spread out, that is about one step each.
        </p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <ContrastColumn
          title="Double the block"
          total={doubling.totalCopied}
          blurb="copies stay rare"
          tone="good"
        />
        <ContrastColumn
          title="Grow by one"
          total={plusOne.totalCopied}
          blurb="copies pile up"
          tone="bad"
        />
      </div>
    </div>
  )
}

function ContrastColumn({
  title,
  total,
  blurb,
  tone,
}: {
  title: string
  total: number
  blurb: string
  tone: "good" | "bad"
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center",
        tone === "good" ? "border-success/40 bg-success-soft/40" : "border-danger/40 bg-danger-soft/40",
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "good" ? "text-success" : "text-danger",
        )}
      >
        {total} copies
      </span>
      <span className="text-xs text-muted-foreground">{blurb}</span>
    </div>
  )
}
