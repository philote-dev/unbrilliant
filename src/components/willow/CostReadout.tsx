import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Shared, reusable cost readout used wherever cost appears across lessons:
 * a wordless work-meter + one "house word" + the concrete count underneath.
 * NEVER show Big-O. The house-word set is fixed so comparisons land across
 * lessons (see docs/lesson-design.md §3).
 */
export type CostWord = "free" | "barely grows" | "scales" | "usually free"

const SEGMENTS = 7
const FILL: Record<CostWord, number> = {
  free: 0.14,
  "usually free": 0.24,
  "barely grows": 0.38,
  scales: 0.86,
}

export function CostReadout({
  word,
  count,
  unit = "steps",
  className,
}: {
  word: CostWord
  count: number
  unit?: string
  className?: string
}) {
  const lit = Math.max(1, Math.round(FILL[word] * SEGMENTS))

  return (
    <div
      className={cn(
        "inline-flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0.25, scaleY: 0.7 }}
              animate={{
                opacity: i < lit ? 1 : 0.2,
                scaleY: i < lit ? 1 : 0.7,
              }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 300 }}
              className={cn(
                "h-5 w-2 rounded-full",
                i < lit ? "bg-lilac-strong" : "bg-muted",
              )}
            />
          ))}
        </div>
        <span className="rounded-full bg-lilac-soft px-2.5 py-0.5 text-sm font-semibold text-lilac-strong">
          {word}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {count} {unit}
      </p>
    </div>
  )
}
