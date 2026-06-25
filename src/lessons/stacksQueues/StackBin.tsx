import type { RefObject } from "react"
import { AnimatePresence } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { StructCell } from "./cell"

// Geometry mirrors the Tailwind classes below, so a freshly pushed cell can fall
// in *from the top opening* down to its grounded slot (deterministic, no DOM
// measurement). CELL = h-14, GAP = gap-2, INNER_H = min-h-[212px] minus p-3 (24).
const CELL_PX = 56
const GAP_PX = 8
const INNER_H = 188

/**
 * A stack as a single-mouth bin: walls on the sides and a closed floor, open
 * only at the TOP, so push and pop happen at the same opening. That one-ended
 * shape is the visual encoding of LIFO (contrast: the QueueTube is open at both
 * ends). Cells are grounded at the floor with the newest (index 0) on top;
 * entry drops in from above and exit lifts out the top.
 *
 * When `dropRef` is supplied (the construct beat) the top opening glows as the
 * drop zone (the only place a card can be dropped) and a newly pushed card
 * falls in from that opening down to its slot.
 */
export function StackBin({
  cells,
  selectable,
  cellState,
  onSelectCell,
  answerId,
  layoutIdFor,
  dropRef,
  dropActive,
  dropOver,
  className,
}: {
  cells: Cell[] // container order: index 0 = top (the exit)
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  /** Maps a cell id to a shared-layout id (continuous construct drop handoff). */
  layoutIdFor?: (id: string) => string | undefined
  dropRef?: RefObject<HTMLDivElement | null>
  dropActive?: boolean
  dropOver?: boolean
  className?: string
}) {
  // The newest cell (index 0 = top) starts at the opening and drops to the pile
  // top; the gap shrinks as the bin fills, so the last card barely moves.
  const pile = cells.length * CELL_PX + Math.max(0, cells.length - 1) * GAP_PX
  const fromOpening = Math.max(16, INNER_H - pile)

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          // Rounded all round (incl. the top opening) so the glow follows a rounded
          // rim rather than a boxy square corner.
          "relative flex min-h-[212px] w-32 flex-col items-center justify-end gap-2 rounded-3xl border-x-2 border-b-2 border-border bg-muted/40 p-3 transition-shadow duration-300",
          // A soft glow that lights up the top rim: an inner glow hugging the upper
          // edge + a faint outer bloom above it. Follows the bin's own (rounded)
          // shape, with no border and no box.
          dropOver
            ? "shadow-[inset_0_7px_11px_-8px_var(--lilac-strong),0_-5px_16px_-3px_var(--lilac-strong)]"
            : dropActive
              ? "shadow-[inset_0_6px_10px_-9px_var(--lilac-strong),0_-4px_12px_-5px_var(--lilac-strong)]"
              : "",
        )}
      >
        {dropRef && (
          /* Invisible, forgiving hit area over the opening, with no visible box. */
          <div
            ref={dropRef}
            aria-hidden
            data-drop-zone={import.meta.env.DEV ? "1" : undefined}
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
          />
        )}
        <AnimatePresence initial={false} mode="popLayout">
          {cells.map((c, i) => (
            <StructCell
              key={c.id}
              id={c.id}
              label={c.label}
              state={cellState?.(c.id) ?? "default"}
              selectable={selectable}
              onSelect={() => onSelectCell?.(c.id)}
              isAnswer={answerId === c.id}
              layoutId={layoutIdFor?.(c.id)}
              enter={{ y: i === 0 ? -fromOpening : -26 }}
              exit={{ y: -64 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
