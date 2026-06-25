import type { RefObject } from "react"
import { ChevronLeft } from "lucide-react"
import { AnimatePresence } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { StructCell } from "./cell"

// Geometry mirrors the Tailwind classes below, so a freshly enqueued cell can
// slide in *from the back opening* to its slot (deterministic, no DOM measure).
// CELL = h-14/min-w-14, GAP = gap-2, INNER_W = min-w-[260px] minus px-3 (24).
const CELL_PX = 56
const GAP_PX = 8
const INNER_W = 236

/**
 * A queue as a through-tube: walls top and bottom, open at BOTH ends. Items
 * enter at the BACK (right) and leave at the FRONT (left). The two openings are
 * the visual encoding of FIFO (contrast: the StackBin has one mouth). Cells run
 * left to right with the front (index 0) at the exit; entry slides in from the
 * back and exit slides out the front, so the motion never lies about which end
 * is used.
 *
 * When `dropRef` is supplied (the construct beat) the BACK opening glows as the
 * drop zone (the only place a card can be dropped) and a newly enqueued card
 * slides in from that opening to its slot.
 */
export function QueueTube({
  cells,
  selectable,
  selectableId,
  cellState,
  cellAriaLabel,
  onSelectCell,
  answerId,
  showEnds,
  layoutIdFor,
  dropRef,
  dropActive,
  dropOver,
  className,
}: {
  cells: Cell[] // container order: index 0 = front (the exit)
  selectable?: boolean
  /** When set, only this cell is selectable (the construct beat's open end). */
  selectableId?: string
  cellState?: (id: string) => AnswerState
  /** Per-cell accessible name (e.g. "Remove A from the back of the queue"). */
  cellAriaLabel?: (id: string) => string | undefined
  onSelectCell?: (id: string) => void
  answerId?: string
  /** Teach-only: label the FRONT (exit) and BACK (entry) ends. Off in predict. */
  showEnds?: boolean
  /** Maps a cell id to a shared-layout id (continuous construct drop handoff). */
  layoutIdFor?: (id: string) => string | undefined
  dropRef?: RefObject<HTMLDivElement | null>
  dropActive?: boolean
  dropOver?: boolean
  className?: string
}) {
  // The newest cell (last index = the back) starts at the back opening and slides
  // left to its slot; the distance shrinks as the queue fills toward the back.
  const backX = INNER_W - CELL_PX
  const last = cells.length - 1
  const cellSelectable = (id: string) =>
    !!selectable && (selectableId === undefined || id === selectableId)

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          // Rounded ends so the glow follows a rounded rim rather than a boxy corner.
          "relative flex min-h-[80px] min-w-[260px] items-center justify-start gap-2 rounded-2xl border-y-2 border-border bg-muted/40 px-3 py-3 transition-shadow duration-300",
          // A soft glow that lights up the back rim: an inner glow hugging the back
          // edge + a faint outer bloom beyond it. Follows the tube's own (rounded)
          // shape, with no border and no box.
          dropOver
            ? "shadow-[inset_-7px_0_11px_-8px_var(--lilac-strong),5px_0_16px_-3px_var(--lilac-strong)]"
            : dropActive
              ? "shadow-[inset_-6px_0_10px_-9px_var(--lilac-strong),4px_0_12px_-5px_var(--lilac-strong)]"
              : "",
        )}
      >
        {dropRef && (
          /* Invisible, forgiving hit area over the back opening, with no visible box. */
          <div
            ref={dropRef}
            aria-hidden
            data-drop-zone={import.meta.env.DEV ? "1" : undefined}
            className="pointer-events-none absolute inset-y-0 right-0 w-16"
          />
        )}
        <AnimatePresence initial={false} mode="popLayout">
          {cells.map((c, i) => (
            <StructCell
              key={c.id}
              id={c.id}
              label={c.label}
              state={cellState?.(c.id) ?? "default"}
              selectable={cellSelectable(c.id)}
              ariaLabel={cellAriaLabel?.(c.id)}
              onSelect={() => onSelectCell?.(c.id)}
              isAnswer={answerId === c.id}
              layoutId={layoutIdFor?.(c.id)}
              enter={{ x: i === last ? Math.max(16, backX - i * (CELL_PX + GAP_PX)) : 30 }}
              exit={{ x: -72 }}
            />
          ))}
        </AnimatePresence>
      </div>
      {showEnds && (
        <div
          aria-hidden
          className="flex w-full min-w-[260px] justify-between px-1 text-[10px] font-bold uppercase tracking-wide text-lilac-strong"
        >
          <span data-testid="end-marker-front" className="flex items-center gap-0.5">
            <ChevronLeft className="size-3" strokeWidth={2.5} />
            Front
          </span>
          <span data-testid="end-marker-back" className="flex items-center gap-0.5">
            Back
            <ChevronLeft className="size-3" strokeWidth={2.5} />
          </span>
        </div>
      )}
    </div>
  )
}
