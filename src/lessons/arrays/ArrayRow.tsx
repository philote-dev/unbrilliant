import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { ShiftFrame } from "@/features/lesson/arraysEngine"

/**
 * A horizontal row of indexed, contiguous cells (value on top, index beneath):
 * the Arrays counterpart to StructureColumn. In the default mode cells can be
 * tapped (the access intro) and the touched index is highlighted.
 *
 * Passing a `frame` switches to the POST-VERDICT wave-of-shifts view: cells slide
 * between fixed address slots one move at a time (frames come from the pure
 * `shiftFrames` selector), so the learner watches the ripple. Reduced motion
 * snaps each cell straight to its slot. The wave reveals the resulting
 * arrangement, so callers only ever mount it after the answer is locked.
 */

// w-10 cell (40px) + gap-1.5 (6px). Cells are absolutely placed at slot * STEP.
const CELL_W = 40
const GAP = 6
const STEP = CELL_W + GAP

export function ArrayRow({
  cells,
  highlight = -1,
  onTap,
  className,
  frame,
  opIndex = -1,
  reduced = false,
}: {
  cells?: string[]
  highlight?: number
  onTap?: (index: number) => void
  className?: string
  /** Wave-of-shifts frame to render instead of a static row (post-verdict only). */
  frame?: ShiftFrame
  /** The op index to keep highlighted on the address ruler during the wave. */
  opIndex?: number
  /** Snap (no animation) for prefers-reduced-motion. */
  reduced?: boolean
}) {
  // Honor the prop when given, else fall back to the OS setting. The hook runs
  // before any branch so the rules of hooks hold for the frame early-return.
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)

  if (frame) {
    return <ShiftWaveRow frame={frame} opIndex={opIndex} reduced={isReduced} className={className} />
  }

  return (
    <div className={cn("flex gap-1.5", className)}>
      {/* Cells are keyed by stable value identity (not index) so an insert/delete
          slides the SAME box between slots instead of remounting it; exits fade
          out through AnimatePresence. Reduced motion snaps straight to rest. */}
      <AnimatePresence initial={false}>
        {(cells ?? []).map((c, i) => (
          <motion.div
            key={c}
            layout={!isReduced}
            className="flex flex-col items-center gap-1"
            initial={isReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={isReduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }}
            transition={isReduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 26 }}
          >
            <button
              type="button"
              disabled={!onTap}
              onClick={() => onTap?.(i)}
              aria-label={onTap ? `Index ${i}, value ${c}` : undefined}
              className={cn(
                "flex h-12 min-w-11 items-center justify-center rounded-lg border-2 px-1 font-bold text-foreground outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                i === highlight
                  ? "border-lilac-strong bg-lilac-soft"
                  : "border-border bg-card",
                onTap ? "cursor-pointer" : "cursor-default",
              )}
            >
              {c}
            </button>
            <span
              className={cn(
                "text-[10px]",
                i === highlight
                  ? "font-semibold text-lilac-strong"
                  : "text-faint",
              )}
            >
              {i}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ShiftWaveRow({
  frame,
  opIndex,
  reduced,
  className,
}: {
  frame: ShiftFrame
  opIndex: number
  reduced: boolean
  className?: string
}) {
  const width = frame.columns * STEP - GAP
  const spring = { type: "spring", stiffness: 420, damping: 32 } as const

  return (
    <div
      className={cn("relative", className)}
      style={{ width, height: 68 }}
      data-testid="shift-wave"
    >
      <div className="absolute inset-x-0 top-0 flex gap-1.5" aria-hidden>
        {Array.from({ length: frame.columns }).map((_, i) => (
          <div key={i} className="flex w-10 flex-col items-center gap-1">
            <div
              className={cn(
                "h-12 w-10 rounded-lg border-2 border-dashed",
                i === opIndex ? "border-lilac-strong/50" : "border-border/60",
              )}
            />
            <span
              className={cn(
                "text-[10px]",
                i === opIndex ? "font-semibold text-lilac-strong" : "text-faint",
              )}
            >
              {i}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {frame.cells.map((c) => (
          <motion.div
            key={c.id}
            className="absolute left-0 top-0"
            initial={{ opacity: 0, scale: 0.6, x: c.slot * STEP }}
            animate={{ opacity: 1, scale: 1, x: c.slot * STEP }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={reduced ? { duration: 0 } : spring}
            data-cell={c.id}
          >
            <div
              className={cn(
                "flex h-12 w-10 items-center justify-center rounded-lg border-2 font-bold text-foreground",
                c.moving ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
              )}
            >
              {c.label}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
