import { Check, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"

/**
 * One cell inside a Stack bin or Queue tube. Shared by both containers so the
 * card itself looks identical — only the container shape and the entry/exit
 * direction differ (that difference is what teaches LIFO vs FIFO).
 *
 * `enter`/`exit` are the motion offsets the owning container passes in (a stack
 * drops in and lifts out the top; a queue slides in the back and out the front),
 * so the animation never lies about which end an item uses. Honors
 * `prefers-reduced-motion` by snapping to the resting state.
 */
const SURFACE: Record<AnswerState, string> = {
  default: "border-border bg-card",
  selected: "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15",
  correct: "border-success bg-success-soft",
  nudge: "border-warning bg-warning-soft",
  fail: "border-danger bg-danger-soft",
}

export interface Offset {
  x?: number
  y?: number
}

export function StructCell({
  id,
  label,
  state = "default",
  selectable,
  disabled,
  onSelect,
  isAnswer,
  leaving,
  enter,
  exit,
  className,
}: {
  id: string
  label: string
  state?: AnswerState
  selectable?: boolean
  disabled?: boolean
  onSelect?: () => void
  isAnswer?: boolean
  leaving?: boolean
  /** Motion offset the cell animates IN from (the opening it enters through). */
  enter: Offset
  /** Motion offset the cell animates OUT to (the opening it leaves through). */
  exit: Offset
  className?: string
}) {
  const reduce = useReducedMotion()
  const resting = { opacity: 1, x: 0, y: 0, scale: 1 }
  const gone = { opacity: 0, x: exit.x ?? 0, y: exit.y ?? 0, scale: 0.9 }

  return (
    <motion.button
      type="button"
      layout
      data-cell={id}
      data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
      disabled={!selectable || disabled}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={state === "selected"}
      initial={reduce ? false : { opacity: 0, x: enter.x ?? 0, y: enter.y ?? 0, scale: 0.9 }}
      animate={leaving ? gone : resting}
      exit={gone}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 26 }}
      whileTap={selectable && !disabled ? { scale: 0.97 } : undefined}
      className={cn(
        "relative flex h-14 min-w-14 items-center justify-center rounded-xl border-2 px-3 text-lg font-bold text-foreground shadow-soft outline-none",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        SURFACE[state],
        selectable && !disabled && "cursor-pointer hover:border-lilac-strong/45",
        className,
      )}
    >
      {label}
      {state === "correct" && (
        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-white">
          <X className="size-3" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}
