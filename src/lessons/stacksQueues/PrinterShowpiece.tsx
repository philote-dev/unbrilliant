import { Printer } from "lucide-react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { QueueTube } from "./QueueTube"

/**
 * The print-queue skin for the queue real-world predict. The GRADED surface is a
 * plain QueueTube (front = the next file to print), so the data-answer hook and
 * the dequeue animation are unchanged. The MEDIUM tier adds a "Now printing"
 * indicator on the FRONT cell ONLY and no cancel control, so the skin stays a
 * pure FIFO: jobs only ever leave from the front, in arrival order. Reduced
 * motion snaps (no indicator animation).
 */
export type ShowpieceTier = "minimal" | "medium"

export function PrinterShowpiece({
  cells,
  selectable,
  cellState,
  onSelectCell,
  answerId,
  leavingId,
  reducedMotion,
  tier = "medium",
  className,
}: {
  cells: Cell[] // container order: index 0 = the front (next to print)
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  leavingId?: string
  reducedMotion?: boolean
  tier?: ShowpieceTier
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const medium = tier === "medium"

  const front = cells[0]

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

      {medium && front && (
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
        cells={cells}
        selectable={selectable}
        cellState={cellState}
        onSelectCell={onSelectCell}
        answerId={answerId}
        leavingId={leavingId}
      />
    </div>
  )
}
