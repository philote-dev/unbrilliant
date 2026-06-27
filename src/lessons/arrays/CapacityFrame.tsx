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
 * trap render through ONE shared figure (`CopyGrow`), so the only visible difference
 * is how much bigger the new block is and how often the copy repeats. Reduced motion
 * snaps to the end-state. Pure and view-only.
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
  copying,
  reduced,
  label,
  slot = SLOT,
}: {
  slots: number
  fill: string[] // labels in the first fill.length slots
  newAt?: number // slot index for the gold "arrival" item
  copying?: boolean // stagger the filled cells in (the copy)
  reduced: boolean
  label?: string
  slot?: number
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
                      reduced ? { duration: 0 } : { delay: copying ? i * 0.08 : 0, type: "spring", stiffness: 360 }
                    }
                    style={{ fontSize: cellFont(slot) }}
                    className={cn(
                      "flex size-full items-center justify-center rounded-md font-bold",
                      isNew ? "bg-amber-200 text-amber-900" : "bg-lilac-soft text-foreground",
                    )}
                  >
                    {isNew ? NEW_LABEL : value}
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
 * The shared grow choreography, used everywhere a block grows: the full old block
 * (faded) on top, an arrow down, and a new bigger block below that copies every
 * item across (staggered) and drops the gold arrival in. Doubling and grow-by-one
 * differ only in `newCapacity` (and, via `cycle`, how often the copy replays), so
 * they read as the same move at different scales. Reduced motion snaps to the
 * copied end-state.
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
}: {
  items: string[]
  newCapacity: number
  withNewItem?: boolean
  oldLabel?: string
  newLabel?: string
  slot?: number
  reduced: boolean
  cycle?: number
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="opacity-45">
        <Block slots={items.length} fill={items} reduced={reduced} label={oldLabel} slot={slot} />
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

/**
 * Beat 10 wrong-answer (growone) visual: the SAME copy choreography as the doubling
 * fix, but the new block is only one bigger, so it is full again the instant the
 * gold item lands. The copy replays on a loop, so the learner feels that every
 * future append repeats the whole copy. Reduced motion shows the copied end-state.
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
  const cycle = useReplayCycle(!isReduced, 2200)
  return (
    <div className="flex flex-col items-center gap-2" data-testid="grow-by-one-loop">
      <CopyGrow
        items={cells}
        newCapacity={cells.length + 1}
        oldLabel="Full block"
        newLabel={`One bigger · copied ${cells.length}`}
        reduced={isReduced}
        cycle={cycle}
      />
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        One bigger, and the next item makes you copy it all again. And again.
      </p>
    </div>
  )
}
