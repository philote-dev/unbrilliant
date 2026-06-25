import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import {
  drainOrder,
  targetEmitStep,
  type Cell,
  type Discipline,
} from "@/features/lesson/stacksQueuesEngine"
import { StackBin } from "./StackBin"
import { QueueTube } from "./QueueTube"

/**
 * The T4 same-input contrast, shown as a synced figure: ONE de-cued arrival
 * feeds a StackBin and a QueueTube at once. On `replay` both drain together and
 * the target is highlighted as it emerges in each, so the learner SEES that the
 * stack hands the target back sooner (or later) than the queue. The winner is a
 * pure function of `targetEmitStep` (smaller step wins), never a model call.
 *
 * Reduced motion skips the ticking drain and renders both already drained with a
 * static "left 1st / left 3rd" readout plus the winner badge. The badge pairs an
 * icon, visible text, and a screen-reader-only status line (never colour alone).
 */
const MS_PER_TICK = 520

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const ones = n % 10
  return `${n}${ones === 1 ? "st" : ones === 2 ? "nd" : ones === 3 ? "rd" : "th"}`
}

function toCells(ids: string[]): Cell[] {
  return ids.map((id) => ({ id, label: id }))
}

function Panel({
  title,
  discipline,
  cells,
  target,
  replay,
  emitStep,
  isWinner,
}: {
  title: string
  discipline: Discipline
  cells: Cell[]
  target: string
  replay: boolean
  emitStep: number
  isWinner: boolean
}) {
  // The target lights up wherever it currently sits so the eye can track it out.
  const cellState = (id: string): AnswerState =>
    replay && id === target ? "selected" : "default"

  return (
    <div
      data-testid={`contrast-${discipline}`}
      className="flex flex-col items-center gap-2"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
        {title}
      </span>
      {discipline === "stack" ? (
        <StackBin cells={cells} cellState={cellState} />
      ) : (
        <QueueTube cells={cells} cellState={cellState} />
      )}
      {replay && (
        <span
          data-testid={`contrast-emit-${discipline}`}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            isWinner
              ? "bg-success-soft text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {target} left {ordinal(emitStep)}
        </span>
      )}
    </div>
  )
}

export function ContrastReplay({
  arrival,
  target,
  winner,
  replay = false,
  reducedMotion,
  srLabel,
  className,
}: {
  arrival: string[]
  target: string
  winner: Discipline
  /** Trigger the dual drain (set on a correct verdict / fail + Why). */
  replay?: boolean
  reducedMotion?: boolean
  srLabel?: string
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  // A stack's container order IS its drain order (newest at the exit); a queue's
  // is the arrival order. So the same de-cued data renders correctly in both.
  const stackOrder = drainOrder(arrival, "stack")
  const queueOrder = drainOrder(arrival, "queue")
  const stackEmit = targetEmitStep(arrival, target, "stack")
  const queueEmit = targetEmitStep(arrival, target, "queue")
  const maxLen = arrival.length

  // How many have drained out of BOTH exits so far (synchronous tick). When
  // reduced motion + replay are set from the first paint, start already drained
  // so there is no exit animation to run (and no AnimatePresence lingering).
  const [drained, setDrained] = useState(() => (replay && reduced ? maxLen : 0))
  useEffect(() => {
    if (!replay) {
      setDrained(0)
      return
    }
    if (reduced) {
      setDrained(maxLen)
      return
    }
    setDrained(0)
    let t = 0
    const id = setInterval(() => {
      t += 1
      setDrained(t)
      if (t >= maxLen) clearInterval(id)
    }, MS_PER_TICK)
    return () => clearInterval(id)
  }, [replay, reduced, maxLen])

  const stackCells = toCells(stackOrder.slice(Math.min(drained, maxLen)))
  const queueCells = toCells(queueOrder.slice(Math.min(drained, maxLen)))

  return (
    <div
      data-testid="contrast-replay"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex flex-col items-center gap-4", className)}
    >
      <div className="flex flex-wrap items-end justify-center gap-5">
        <Panel
          title="Queue"
          discipline="queue"
          cells={queueCells}
          target={target}
          replay={replay}
          emitStep={queueEmit}
          isWinner={winner === "queue"}
        />
        <Panel
          title="Stack"
          discipline="stack"
          cells={stackCells}
          target={target}
          replay={replay}
          emitStep={stackEmit}
          isWinner={winner === "stack"}
        />
      </div>

      {replay && (
        <div
          data-testid="contrast-winner"
          data-contrast-winner={import.meta.env.DEV ? winner : undefined}
          className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success"
        >
          <Trophy className="size-4" strokeWidth={2.5} aria-hidden />
          <span>
            The {winner} hands you {target} first
          </span>
        </div>
      )}

      {srLabel && (
        <p className="sr-only" role="status">
          {srLabel}
        </p>
      )}
    </div>
  )
}
