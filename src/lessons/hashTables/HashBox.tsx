import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RewireSource } from "@/components/rewire/RewireSource"
import { letterSteps, type HashQuestion } from "@/features/lesson/hashTablesEngine"

/**
 * The learner-runnable hash function box. A Step control walks the key
 * letter-by-letter (each letter lights with its value, the running sum ticks
 * up); the box scaffolds the *sum* but never the `mod`: the learner supplies
 * the bucket by dragging the key in (drag beats, via `dragSourceId`) or tapping
 * a bucket (tap beats). It never pre-lights the answer bucket.
 *
 * On the ungraded DEMO beat only (`reveal`), the box finishes the arithmetic
 * itself: once every letter is added it shows `sum mod B = bucket` and flags the
 * result via `onResolved` so an owner (HashFlight) can fly the key into its
 * bucket. Graded beats keep withholding the bucket as "?".
 */
export function HashBox({
  question,
  dragSourceId,
  reveal,
  onResolved,
}: {
  question: HashQuestion
  /** When set (drag beats), the key tile is a draggable RewireSource. */
  dragSourceId?: string
  /** DEMO beat only: finish the `mod` and reveal the bucket once every letter is in. */
  reveal?: boolean
  /** Fires once the bucket is resolved (reveal beats), so an owner can react. */
  onResolved?: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const key = question.key ?? ""
  const steps = letterSteps(key)
  const B = question.bucketCount
  const [revealed, setRevealed] = useState(0)
  const allRevealed = revealed >= steps.length
  const runningSum = revealed > 0 ? steps[revealed - 1].runningSum : 0
  const showBucket = Boolean(reveal) && allRevealed

  // Tell the owner the moment the box resolves the bucket, so a demo can launch
  // the key's flight to that bucket. Purely a notification: the verdict is still
  // the pure `question.bucket`.
  useEffect(() => {
    if (showBucket) onResolved?.()
  }, [showBucket, onResolved])

  return (
    <div className="flex w-full max-w-[280px] flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-lilac-strong">
        hash( {key} )
      </p>

      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span
              className={cn(
                "flex h-10 w-9 items-center justify-center rounded-lg border-2 text-base font-bold text-foreground transition-colors",
                i < revealed
                  ? "border-lilac-strong bg-lilac-soft"
                  : "border-border bg-card",
              )}
            >
              {s.ch}
            </span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                i < revealed ? "font-semibold text-lilac-strong" : "text-faint",
              )}
            >
              {i < revealed ? s.value : "·"}
            </span>
          </div>
        ))}
      </div>

      <div className="text-center text-sm">
        <p className="tabular-nums text-foreground">
          sum ={" "}
          <span className="font-bold">{allRevealed ? question.sum : runningSum}</span>
          {!allRevealed && revealed > 0 ? " …" : ""}
        </p>
        <p className="mt-0.5 tabular-nums text-muted-foreground">
          {question.sum} mod {B} ={" "}
          <span className="font-semibold text-lilac-strong">
            {showBucket ? question.bucket : "?"}
          </span>
        </p>
      </div>

      {revealed < steps.length && (
        <Button
          variant="soft"
          size="sm"
          onClick={() => setRevealed((r) => Math.min(steps.length, r + 1))}
        >
          {revealed === 0 ? "Add the letters" : "Add next letter"}
        </Button>
      )}

      {showBucket && (
        <div className="flex items-center gap-2" data-testid="hash-fly">
          <motion.span
            initial={reduced ? false : { x: -36, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
            className="flex h-8 min-w-8 items-center justify-center rounded-lg border-2 border-lilac-strong bg-lilac-soft px-2 text-sm font-bold text-foreground"
          >
            {key}
          </motion.span>
          <ArrowRight className="size-3 shrink-0 text-faint" aria-hidden />
          <span className="rounded-lg border-2 border-lilac-strong bg-lilac-soft px-2 py-1 text-sm font-bold text-lilac-strong">
            bucket {question.bucket}
          </span>
        </div>
      )}

      {dragSourceId ? (
        <div
          data-hash-correct-bucket={
            import.meta.env.DEV ? `bucket-${question.bucket}` : undefined
          }
        >
          <RewireSource id={dragSourceId} label={`Drag ${key} to its bucket`}>
            {key}
          </RewireSource>
        </div>
      ) : reveal ? null : (
        <p className="text-center text-xs text-muted-foreground">
          Tap the bucket it lands in.
        </p>
      )}

      <p className="sr-only" role="status">
        {key}: {steps.map((s) => `${s.ch} is ${s.value}`).join(", ")}; sum {question.sum};{" "}
        {question.sum} mod {B}
        {showBucket ? ` = ${question.bucket}; ${key} lands in bucket ${question.bucket}` : ""}.
      </p>
    </div>
  )
}
