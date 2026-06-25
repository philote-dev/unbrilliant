import { Printer } from "lucide-react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { QueueTube } from "./QueueTube"

/**
 * The print-queue skin for the queue real-world predict. Kept as the FALLBACK
 * behind the Stage's REALWORLD_QUEUE_SKIN switch (the primary skin is
 * DriveThruLane). The graded surface is a plain QueueTube (front = the next file
 * to print), so the data-answer hook and the dequeue animation are unchanged. A
 * "Now printing" indicator marks the FRONT job ONLY (no cancel control), so the
 * skin stays a pure FIFO.
 *
 * Choreography is presentational and driven by `popping` (flipped a beat AFTER
 * the verdict): the front job leaves the tube and the rest roll forward. Reduced
 * motion snaps to the end-state.
 */
export function PrinterShowpiece({
  cells,
  selectable,
  cellState,
  onSelectCell,
  answerId,
  popping = false,
  reducedMotion,
  className,
}: {
  cells: Cell[] // container order: index 0 = the front (next to print)
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  popping?: boolean
  reducedMotion?: boolean
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  // While popping, the front job leaves the tube; the rest roll forward.
  const shown =
    popping && answerId ? cells.filter((c) => c.id !== answerId) : cells
  const front = shown[0]

  return (
    <div
      data-testid="printer-showpiece"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex w-full max-w-[320px] flex-col items-center gap-3", className)}
    >
      <div className="inline-flex items-center gap-1.5 rounded-full bg-lilac-soft px-3 py-1 text-xs font-semibold text-lilac-strong">
        <Printer className="size-3.5" strokeWidth={2.5} aria-hidden />
        Print queue
      </div>

      {front && (
        <div
          data-testid="printer-now-printing"
          className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success"
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex size-full rounded-full bg-success/60",
                reduced ? "" : "animate-ping",
              )}
            />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Now printing: {front.label}
        </div>
      )}

      <QueueTube
        cells={shown}
        selectable={selectable}
        cellState={cellState}
        onSelectCell={onSelectCell}
        answerId={answerId}
      />
    </div>
  )
}
