import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { appendRun } from "@/features/lesson/arraysEngine"
import { CopyGrow } from "./CapacityFrame"
import { useReplayCycle } from "./useReplayCycle"

/**
 * The average-cost summary figure (beat 11). It shows the SAME grow choreography
 * from the previous beat, twice and side by side: doubling (a big block, so the
 * copy is rare) next to grow-by-one (a barely-bigger block that fills again at
 * once, so the copy repeats fast). Each runs on its own cadence, and the total
 * copies over a run of 8 appends sit beneath the respective block: 7 (doubling)
 * vs 28 (grow-by-one). Numbers come from the pure `appendRun` helper, so they are
 * deterministic and unit-tested. Reduced motion holds it at rest. Pure and
 * view-only (no Big-O, no "amortization" wording).
 */
const APPENDS = 8
const SUMMARY_SLOT = 18
const ITEMS = ["A", "B", "C", "D"]

export function GrowSummary({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const doubling = appendRun(APPENDS, "double")
  const plusOne = appendRun(APPENDS, "plusOne")
  // Doubling copies rarely (slow replay); grow-by-one copies on almost every
  // append (fast replay). The cadence contrast carries the lesson with the totals.
  const slow = useReplayCycle(!isReduced, 3200)
  const fast = useReplayCycle(!isReduced, 1400)

  return (
    <div className="flex w-full items-start justify-center gap-6" data-testid="grow-summary">
      <SummaryColumn
        title="Double the block"
        newCapacity={ITEMS.length * 2}
        newLabel="…to 8"
        cycle={slow}
        reduced={isReduced}
        total={doubling.totalCopied}
        blurb="copies stay rare"
        tone="good"
      />
      <SummaryColumn
        title="Grow by one"
        newCapacity={ITEMS.length + 1}
        newLabel="…to 5"
        cycle={fast}
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
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <CopyGrow
        items={ITEMS}
        newCapacity={newCapacity}
        oldLabel="Full"
        newLabel={newLabel}
        slot={SUMMARY_SLOT}
        reduced={reduced}
        cycle={cycle}
      />
      <div
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2",
          tone === "good"
            ? "border-success/40 bg-success-soft/40"
            : "border-danger/40 bg-danger-soft/40",
        )}
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
      </div>
    </div>
  )
}
