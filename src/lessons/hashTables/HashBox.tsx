import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RewireSource } from "@/components/rewire/RewireSource"
import { letterSteps, type HashQuestion } from "@/features/lesson/hashTablesEngine"

/**
 * The learner-runnable hash function box. A Step control walks the key
 * letter-by-letter (each letter lights with its value, the running sum ticks
 * up); the box scaffolds the *sum* but never the `mod` — the learner supplies
 * the bucket by dragging the key in (drag beats, via `dragSourceId`) or tapping
 * a bucket (tap beats). It never pre-lights the answer bucket.
 */
export function HashBox({
  question,
  dragSourceId,
}: {
  question: HashQuestion
  /** When set (drag beats), the key tile is a draggable RewireSource. */
  dragSourceId?: string
}) {
  const key = question.key ?? ""
  const steps = letterSteps(key)
  const B = question.bucketCount
  const [revealed, setRevealed] = useState(0)
  const allRevealed = revealed >= steps.length
  const runningSum = revealed > 0 ? steps[revealed - 1].runningSum : 0

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
          <span className="font-semibold text-lilac-strong">?</span>
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
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Tap the {question.contacts ? "slot" : "bucket"} it lands in.
        </p>
      )}

      <p className="sr-only" role="status">
        {key}: {steps.map((s) => `${s.ch} is ${s.value}`).join(", ")}; sum {question.sum};{" "}
        {question.sum} mod {B}.
      </p>
    </div>
  )
}
