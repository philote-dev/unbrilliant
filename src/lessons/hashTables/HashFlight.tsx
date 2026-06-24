import { useCallback, useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"

import { chainAfter, type HashQuestion } from "@/features/lesson/hashTablesEngine"
import { HashBox } from "./HashBox"
import { HashTable } from "./HashTable"

// Geometry mirrors the HashTable's Tailwind classes, so the key can fly from the
// box straight down into bucket N along a computed path (deterministic, no DOM
// measurement). ROW_H = min-h-12 (48), ROW_GAP = gap-1.5 (6); FLIGHT_RISE lifts
// the start up past the table's top edge so it reads as "out of the box above".
const ROW_H = 48
const ROW_GAP = 6
const FLIGHT_RISE = 48
/** Horizontal drop from the box's centre to the bucket's chain inset. */
const FLIGHT_DRIFT = 72

/**
 * The DEMO figure: it OWNS the runnable {@link HashBox} and the {@link HashTable}
 * and choreographs the payoff the lesson promises. Step the box letter by letter;
 * once it resolves `sum mod B`, the key tile flies down from the box into bucket
 * N's chain and the bucket lights up. The flight is presentational only: the
 * landing bucket is the pure `question.bucket`, and reduced motion snaps the key
 * straight into place (no travel). Demo-only and ungraded.
 */
export function HashFlight({ question }: { question: HashQuestion }) {
  const reduced = useReducedMotion() ?? false
  const [resolved, setResolved] = useState(false)
  const [landed, setLanded] = useState(false)
  const onResolved = useCallback(() => setResolved(true), [])

  const bucket = question.bucket
  const key = question.key ?? ""
  const base = question.table
  // Once it lands, the key is appended to its bucket's chain (a pure append of
  // the same `bucket` the engine would compute. The animation never decides it).
  const table = landed ? { ...base, [bucket]: chainAfter(base[bucket] ?? [], key) } : base

  // The box tells us the moment it resolves; a beat later the key drops in (or
  // immediately, snapping, under reduced motion).
  useEffect(() => {
    if (!resolved) return
    if (reduced) {
      setLanded(true)
      return
    }
    const id = setTimeout(() => setLanded(true), 280)
    return () => clearTimeout(id)
  }, [resolved, reduced])

  const enterOffset = {
    x: FLIGHT_DRIFT,
    y: -(bucket * (ROW_H + ROW_GAP) + FLIGHT_RISE),
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <HashBox question={question} reveal onResolved={onResolved} />
      <HashTable
        bucketCount={question.bucketCount}
        table={table}
        mode="display"
        highlightBucket={landed ? bucket : undefined}
        newestBucket={landed ? bucket : undefined}
        appendingBucket={landed ? bucket : undefined}
        appendEnterOffset={enterOffset}
        reducedMotion={reduced}
      />
    </div>
  )
}
