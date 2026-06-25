import { Check, X } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

export type AnswerState = "default" | "selected" | "correct" | "nudge" | "fail"

const SURFACE: Record<AnswerState, string> = {
  default: "border-border bg-card hover:border-lilac-strong/45",
  selected: "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15",
  correct: "border-success bg-success-soft",
  nudge: "border-warning bg-warning-soft",
  fail: "border-danger bg-danger-soft",
}

const BADGE: Record<AnswerState, string> = {
  default: "bg-muted text-foreground",
  selected: "bg-lilac text-lilac-foreground",
  correct: "bg-success text-white",
  nudge: "bg-warning text-warning-foreground",
  fail: "bg-danger text-white",
}

/**
 * Core selectable answer card. Two layouts: a labeled row (letter badge + text)
 * or a big centered letter (lesson player). Optional corner tag (TOP/FRONT/BACK).
 */
export function AnswerCard({
  letter,
  label,
  tag,
  state = "default",
  disabled,
  onSelect,
  className,
  answerMarker,
}: {
  letter: string
  label?: string
  tag?: string
  state?: AnswerState
  disabled?: boolean
  onSelect?: () => void
  className?: string
  /** Dev-only test hook: marks the winning option so the e2e tracer can pick it
   * deterministically (multi-choice lessons have no visible TOP/FRONT tell). */
  answerMarker?: boolean
}) {
  const compact = Boolean(label)

  return (
    <motion.button
      type="button"
      data-testid="answer-card"
      data-answer={answerMarker && import.meta.env.DEV ? "1" : undefined}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={state === "selected"}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      animate={state === "nudge" ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className={cn(
        "relative w-full rounded-2xl border-2 text-left transition-colors duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-default",
        SURFACE[state],
        compact
          ? "flex items-center gap-4 p-4 lg:gap-5 lg:p-5"
          : "flex min-h-24 items-center justify-center p-5 lg:min-h-28 lg:p-6",
        className,
      )}
    >
      {tag && (
        <span className="absolute right-3 top-3 rounded-md bg-lilac px-2 py-0.5 text-[11px] font-bold tracking-wide text-lilac-foreground">
          {tag}
        </span>
      )}

      {compact ? (
        <>
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-colors lg:size-12 lg:text-xl",
              BADGE[state],
            )}
          >
            {letter}
          </span>
          <span className="text-[15px] font-medium text-foreground lg:text-lg">{label}</span>
        </>
      ) : (
        <span className="text-3xl font-bold text-foreground lg:text-4xl">{letter}</span>
      )}

      {state === "correct" && (
        <span className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-danger text-white">
          <X className="size-3.5" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}
