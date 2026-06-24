import type { RefObject } from "react"
import { AnimatePresence } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { StructCell } from "./cell"

// Geometry mirrors the Tailwind classes below, so a freshly enqueued cell can
// slide in *from the back opening* to its slot (deterministic, no DOM measure).
// CELL = h-14/min-w-14, GAP = gap-2, INNER_W = min-w-[260px] − px-3 (24).
const CELL_PX = 56
const GAP_PX = 8
const INNER_W = 236

/**
 * A queue as a through-tube: walls top and bottom, open at BOTH ends — items
 * enter at the BACK (right) and leave at the FRONT (left). The two openings are
 * the visual encoding of FIFO (contrast: the StackBin has one mouth). Cells run
 * left→right with the front (index 0) at the exit; entry slides in from the back
 * and exit slides out the front, so the motion never lies about which end is used.
 *
 * When `dropRef` is supplied (the construct beat) the BACK opening glows as the
 * drop zone — the only place a card can be dropped — and a newly enqueued card
 * slides in from that opening to its slot.
 */
export function QueueTube({
  cells,
  selectable,
  cellState,
  onSelectCell,
  answerId,
  leavingId,
  dropRef,
  dropActive,
  dropOver,
  className,
}: {
  cells: Cell[] // container order: index 0 = front (the exit)
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  leavingId?: string
  dropRef?: RefObject<HTMLDivElement | null>
  dropActive?: boolean
  dropOver?: boolean
  className?: string
}) {
  // The newest cell (last index = the back) starts at the back opening and slides
  // left to its slot; the distance shrinks as the queue fills toward the back.
  const backX = INNER_W - CELL_PX
  const last = cells.length - 1

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          // Rounded ends so the glow follows a rounded rim rather than a boxy corner.
          "relative flex min-h-[80px] min-w-[260px] items-center justify-start gap-2 rounded-2xl border-y-2 border-border bg-muted/40 px-3 py-3 transition-shadow duration-300",
          // A soft glow that lights up the back rim: an inner glow hugging the back
          // edge + a faint outer bloom beyond it. Follows the tube's own (rounded)
          // shape — no border, no box.
          dropOver
            ? "shadow-[inset_-7px_0_11px_-8px_var(--lilac-strong),5px_0_16px_-3px_var(--lilac-strong)]"
            : dropActive
              ? "shadow-[inset_-6px_0_10px_-9px_var(--lilac-strong),4px_0_12px_-5px_var(--lilac-strong)]"
              : "",
        )}
      >
        {dropRef && (
          /* Invisible, forgiving hit area over the back opening — no visible box. */
          <div
            ref={dropRef}
            aria-hidden
            data-drop-zone={import.meta.env.DEV ? "1" : undefined}
            className="pointer-events-none absolute inset-y-0 right-0 w-16"
          />
        )}
        <AnimatePresence initial={false}>
          {cells.map((c, i) => (
            <StructCell
              key={c.id}
              id={c.id}
              label={c.label}
              state={cellState?.(c.id) ?? "default"}
              selectable={selectable}
              onSelect={() => onSelectCell?.(c.id)}
              isAnswer={answerId === c.id}
              leaving={leavingId === c.id}
              enter={{ x: i === last ? Math.max(16, backX - i * (CELL_PX + GAP_PX)) : 30 }}
              exit={{ x: -30 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
