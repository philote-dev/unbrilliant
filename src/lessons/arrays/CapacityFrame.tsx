import { ArrowDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { ArrayResize } from "@/features/lesson/arraysEngine"

/**
 * The dynamic-array capacity frame: the backing block sized to `capacity`, with
 * `size` filled slots. When the block is full, appending one more allocates a
 * block twice the size and copies every item across (the "occasional big
 * reshuffle"), then drops the new item in; when there is room, the item just
 * lands. The double-and-copy fires on `reveal` (post-verdict); reduced motion
 * snaps to the end-state. Pure and view-only.
 */

const SLOT = 34
const NEW_LABEL = "X"

function Block({
  slots,
  fill,
  newAt,
  copying,
  reduced,
  label,
}: {
  slots: number
  fill: string[] // labels in the first fill.length slots
  newAt?: number // slot index for the gold "arrival" item
  copying?: boolean // stagger the filled cells in (the copy)
  reduced: boolean
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex" style={{ width: slots * SLOT }}>
        {Array.from({ length: slots }).map((_, i) => {
          const value = i < fill.length ? fill[i] : undefined
          const isNew = newAt === i
          return (
            <div
              key={i}
              className="box-border flex items-center justify-center border-y-2 border-l-2 last:border-r-2 first:rounded-l-lg last:rounded-r-lg"
              style={{ width: SLOT, height: SLOT }}
            >
              <AnimatePresence>
                {(value !== undefined || isNew) && (
                  <motion.span
                    initial={reduced ? false : { opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      reduced ? { duration: 0 } : { delay: copying ? i * 0.08 : 0, type: "spring", stiffness: 360 }
                    }
                    className={cn(
                      "flex size-full items-center justify-center rounded-md text-sm font-bold",
                      isNew
                        ? "bg-amber-200 text-amber-900"
                        : "bg-lilac-soft text-foreground",
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
    <div className="flex flex-col items-center gap-2" data-testid="capacity-frame">
      <div className="opacity-50">
        <Block slots={capacity} fill={cells.slice(0, size)} reduced={isReduced} label="Old block · full" />
      </div>
      <ArrowDown className="size-4 text-lilac-strong" aria-hidden />
      <Block
        slots={grown}
        fill={cells.slice(0, size)}
        newAt={size}
        copying
        reduced={isReduced}
        label={`Doubled to ${grown} · copied ${size}`}
      />
    </div>
  )
}

/**
 * Beat 9 memory teach: a full backing block, and a new item that tries to drop in
 * but bounces off because there is no slot (shake + a red flash, repeated once).
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
  const capacity = cells.length
  return (
    <div className="flex flex-col items-center gap-3" data-testid="full-block-reject">
      <Block
        slots={capacity}
        fill={cells}
        reduced={isReduced}
        label={`Backing block · ${capacity} of ${capacity}`}
      />
      <div className="flex items-center gap-2">
        <motion.span
          data-testid="reject-incoming"
          className="flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-bold text-amber-900"
          initial={false}
          animate={
            isReduced
              ? { backgroundColor: "#fecaca" }
              : { x: [0, 34, 6, 0], backgroundColor: ["#fde68a", "#fecaca", "#fecaca", "#fde68a"] }
          }
          transition={
            isReduced
              ? { duration: 0 }
              : { duration: 1.2, repeat: 1, repeatDelay: 0.5, ease: "easeInOut" }
          }
        >
          {NEW_LABEL}
        </motion.span>
        <span className="text-xs font-bold uppercase tracking-wide text-danger">No room</span>
      </div>
    </div>
  )
}
