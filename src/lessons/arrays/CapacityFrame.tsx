import { ArrowDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { ArrayResize } from "@/features/lesson/arraysEngine"
import { useReplayCycle } from "./useReplayCycle"

/**
 * The dynamic-array capacity frame and its grow choreography. The backing block is
 * sized to `capacity` with `size` filled slots; when it is full, appending one more
 * allocates a bigger block and copies every item across (the "occasional big
 * reshuffle"), then drops the new item in. Both the doubling fix and the grow-by-one
 * trap render through the same `Block` figure, so the only visible difference is how
 * much bigger the new block is and how often the copy repeats. Reduced motion snaps
 * to the end-state. Pure and view-only.
 */

const SLOT = 34
const NEW_LABEL = "X"

function cellFont(slot: number): number {
  if (slot >= 40) return 16
  if (slot >= 26) return 13
  return 10
}

function Block({
  slots,
  fill,
  newAt,
  goldLabel = NEW_LABEL,
  copying,
  reduced,
  label,
  slot = SLOT,
  baseDelay = 0,
  stagger = 0.08,
}: {
  slots: number
  fill: string[] // labels in the first fill.length slots
  newAt?: number // slot index for the gold "arrival" item
  goldLabel?: string // the gold cell's label (defaults to the new item "X")
  copying?: boolean // stagger the filled cells in (the copy)
  reduced: boolean
  label?: string
  slot?: number
  baseDelay?: number // hold before this block animates (sequencing / read-the-title)
  stagger?: number // per-cell copy delay (raise it to slow the copy down)
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex" style={{ width: slots * slot }}>
        {Array.from({ length: slots }).map((_, i) => {
          const value = i < fill.length ? fill[i] : undefined
          const isNew = newAt === i
          return (
            <div
              key={i}
              className="box-border flex items-center justify-center border-y-2 border-l-2 last:border-r-2 first:rounded-l-lg last:rounded-r-lg"
              style={{ width: slot, height: slot }}
            >
              <AnimatePresence>
                {(value !== undefined || isNew) && (
                  <motion.span
                    initial={reduced ? false : { opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { delay: baseDelay + (copying ? i * stagger : 0), type: "spring", stiffness: 360 }
                    }
                    style={{ fontSize: cellFont(slot) }}
                    className={cn(
                      "flex size-full items-center justify-center rounded-md font-bold",
                      isNew ? "bg-amber-200 text-amber-900" : "bg-lilac-soft text-foreground",
                    )}
                  >
                    {isNew ? goldLabel : value}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The shared grow choreography: a full old block (faded) on top, an arrow down, and
 * a new bigger block below that copies every item across (staggered) and drops the
 * gold arrival in. Doubling and grow-by-one differ only in `newCapacity` (and, via
 * `cycle`, how often the copy replays), so they read as the same move at different
 * scales. `baseDelay` holds the copy back so the full block lands first (used by the
 * summary so the learner reads the title, then watches the copy); reduced motion
 * snaps to the copied end-state.
 */
export function CopyGrow({
  items,
  newCapacity,
  withNewItem = true,
  oldLabel,
  newLabel,
  slot = SLOT,
  reduced,
  cycle = 0,
  baseDelay = 0,
  stagger = 0.08,
}: {
  items: string[]
  newCapacity: number
  withNewItem?: boolean
  oldLabel?: string
  newLabel?: string
  slot?: number
  reduced: boolean
  cycle?: number
  baseDelay?: number
  stagger?: number
}) {
  // When delayed (the summary), the full block settles first, then a beat later the
  // copy plays; an un-delayed reveal stays snappy (the grow verdict).
  const copyDelay = baseDelay > 0 ? baseDelay + 0.5 : 0
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="opacity-45">
        <Block slots={items.length} fill={items} reduced={reduced} label={oldLabel} slot={slot} baseDelay={baseDelay} />
      </div>
      <ArrowDown className="size-4 shrink-0 text-lilac-strong" aria-hidden />
      <Block
        key={cycle}
        slots={newCapacity}
        fill={items}
        newAt={withNewItem ? items.length : undefined}
        copying
        reduced={reduced}
        label={newLabel}
        slot={slot}
        baseDelay={copyDelay}
        stagger={stagger}
      />
    </div>
  )
}

export function CapacityFrame({
  resize,
  cells,
  reveal,
  reduced,
}: {
  resize: ArrayResize
  cells: string[]
  reveal: boolean
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const { size, capacity, resizes } = resize

  if (!reveal) {
    return (
      <div className="relative" data-testid="capacity-frame">
        <Block
          slots={capacity}
          fill={cells.slice(0, size)}
          reduced={isReduced}
          label={`Backing block · ${size} of ${capacity}`}
        />
        {size >= capacity && (
          <span className="mt-2 block text-center text-xs font-bold uppercase tracking-wide text-danger">
            Full
          </span>
        )}
      </div>
    )
  }

  if (!resizes) {
    return (
      <div data-testid="capacity-frame">
        <Block
          slots={capacity}
          fill={cells.slice(0, size)}
          newAt={size}
          reduced={isReduced}
          label="Room to spare"
        />
      </div>
    )
  }

  const grown = capacity * 2
  return (
    <div data-testid="capacity-frame">
      <CopyGrow
        items={cells.slice(0, size)}
        newCapacity={grown}
        oldLabel="Old block · full"
        newLabel={`Doubled to ${grown} · copied ${size}`}
        reduced={isReduced}
      />
    </div>
  )
}

/**
 * Beat 9 memory teach: a full backing block, and a new cell that tries to drop into
 * the slot past the end. There is no such slot, so it bumps the wall and is turned
 * away (a red flash on the dashed would-be slot and the cell), over and over.
 * Reduced motion snaps to the static rejected end-state. Pure and view-only.
 */
export function FullBlockReject({
  cells,
  reduced,
}: {
  cells: string[]
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const BIG = 46
  const pulse = { duration: 1.1, repeat: Infinity, repeatDelay: 0.3, ease: "easeInOut" } as const
  return (
    <div className="flex flex-col items-center gap-4" data-testid="full-block-reject">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Backing block · full
      </span>
      <div className="flex items-center gap-2.5">
        <Block slots={cells.length} fill={cells} reduced={isReduced} slot={BIG} />
        {/* the slot past the end does not exist: the new cell pushes toward it and
            is bounced back, the dashed wall flashing red each time it tries. */}
        <motion.div
          aria-hidden
          className="box-border flex items-center justify-center rounded-lg border-2 border-dashed"
          style={{ width: BIG, height: BIG }}
          initial={false}
          animate={
            isReduced
              ? { borderColor: "#ef4444" }
              : { borderColor: ["#d4d4d8", "#ef4444", "#d4d4d8"] }
          }
          transition={isReduced ? { duration: 0 } : pulse}
        >
          <motion.span
            data-testid="reject-incoming"
            className="flex items-center justify-center rounded-md font-bold text-amber-900"
            style={{ width: BIG - 12, height: BIG - 12, fontSize: 16 }}
            initial={false}
            animate={
              isReduced
                ? { x: 0, backgroundColor: "#fecaca" }
                : { x: [0, -9, 0], backgroundColor: ["#fde68a", "#fecaca", "#fde68a"] }
            }
            transition={isReduced ? { duration: 0 } : pulse}
          >
            {NEW_LABEL}
          </motion.span>
        </motion.div>
      </div>
      <span className="text-sm font-bold uppercase tracking-wide text-danger">No room</span>
    </div>
  )
}

/** One step's arrow + cost tag inside the grow-by-one chain. */
function CopyTick({
  label,
  delay,
  reduced,
}: {
  label: string
  delay: number
  reduced: boolean
}) {
  return (
    <motion.div
      className="flex items-center gap-1.5"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { delay }}
      aria-hidden
    >
      <ArrowDown className="size-3.5 text-danger" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">{label}</span>
    </motion.div>
  )
}

/**
 * Beat 10 wrong-answer (growone) visual: two appends in a row, to show the trap.
 * The block is full, so a one-bigger block is made and everything is copied to add
 * X; that block is full again at once, so the very next item copies it ALL again
 * (now including X) to add Y. The copy count climbs (copy n, then copy n+1), which
 * is the point: grow-by-one re-copies on every append, again and again. Reduced
 * motion snaps to the end-state. Pure and view-only.
 */
export function GrowByOneLoop({
  cells,
  reduced,
}: {
  cells: string[]
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const cycle = useReplayCycle(!isReduced, 4600)
  const n = cells.length
  const SL = 30
  const stagger = 0.12
  const afterFirst = [...cells, "X"] // the X just added is now just more to copy
  const d1 = 0.25 // step 1 copy begins
  const d2 = d1 + (n + 1) * stagger + 0.6 // step 2 begins after step 1 settles
  return (
    <div className="flex flex-col items-center gap-1" data-testid="grow-by-one-loop">
      <Block key={`a${cycle}`} slots={n} fill={cells} reduced={isReduced} slot={SL} label="Full block" />
      <CopyTick label={`copy ${n}, add 1`} delay={d1 - 0.1} reduced={isReduced} />
      <Block
        key={`b${cycle}`}
        slots={n + 1}
        fill={cells}
        newAt={n}
        goldLabel="X"
        copying
        reduced={isReduced}
        slot={SL}
        baseDelay={d1}
        stagger={stagger}
      />
      <CopyTick label={`copy ${n + 1}, add 1`} delay={d2 - 0.1} reduced={isReduced} />
      <Block
        key={`c${cycle}`}
        slots={n + 2}
        fill={afterFirst}
        newAt={n + 1}
        goldLabel="Y"
        copying
        reduced={isReduced}
        slot={SL}
        baseDelay={d2}
        stagger={stagger}
      />
      <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
        One bigger only delays it: the next item makes you copy it all again. And again.
      </p>
    </div>
  )
}
