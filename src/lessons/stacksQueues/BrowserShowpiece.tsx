import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { StackBin } from "./StackBin"

/**
 * The Browser Back skin for the stack real-world predict. The GRADED surface is
 * a plain StackBin holding the page history (newest on top): the page you leave
 * is the top, exactly the stack verdict, so the data-answer hook and the pop
 * animation are unchanged. The MEDIUM tier wraps it in minimal browser chrome
 * and adds a presentational FORWARD stack that repopulates when the Back replay
 * pops the current page (`leavingId`), so the skin reads as a real browser
 * without ever touching the verdict. Reduced motion snaps (no chrome animation).
 */
export type ShowpieceTier = "minimal" | "medium"

export function BrowserShowpiece({
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
  cells: Cell[] // container order: index 0 = the current page (top of history)
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

  const current = cells[0]?.label ?? "New tab"
  // The Back replay pops the current page; in the medium skin it lands in forward.
  const forward = leavingId ? cells.filter((c) => c.id === leavingId) : []

  return (
    <div
      data-testid="browser-showpiece"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex w-full max-w-[320px] flex-col gap-3", className)}
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 shadow-soft">
        <div className="flex items-center gap-1 text-lilac-strong">
          <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
          <ArrowRight className="size-4 text-faint" strokeWidth={2.5} aria-hidden />
          <RotateCw className="size-3.5 text-faint" strokeWidth={2.5} aria-hidden />
        </div>
        <div
          data-testid="browser-address"
          className="flex-1 truncate rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          {current}
        </div>
      </div>

      <div className="flex items-end justify-center gap-4">
        <div data-testid="browser-history" className="flex flex-col items-center gap-1.5">
          <StackBin
            cells={cells}
            selectable={selectable}
            cellState={cellState}
            onSelectCell={onSelectCell}
            answerId={answerId}
            leavingId={leavingId}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
            History
          </span>
        </div>

        {medium && (
          <div data-testid="browser-forward" className="flex flex-col items-center gap-1.5">
            <StackBin cells={forward} className="opacity-70" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
              Forward
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
