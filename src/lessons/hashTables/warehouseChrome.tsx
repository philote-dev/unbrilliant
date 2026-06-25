import type { Dispatch, ReactNode } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import type { Feedback, LessonAction } from "@/features/lesson/engine"

/**
 * Shared chrome for the full-bleed warehouse beats. Like the Linked Lists Spotify
 * skin, a beat bleeds out of the lesson padding (`-mx-5 -mb-6`) and re-themes the
 * whole page into the Amazon-style fulfilment center: squid-ink walls, safety
 * orange, kraft cardboard. The themed footer dispatches the SAME engine actions
 * as the shared FeedbackFooter, so grading and the flame are unchanged.
 */

/** Amazon-ish palette, used across the warehouse figures too. */
export const WH = {
  ink: "#232f3e",
  orange: "#ff9900",
  blue: "#48a3df",
} as const

export function WarehousePage({
  children,
  reduced,
}: {
  children: ReactNode
  reduced?: boolean | null
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col bg-[#232f3e] px-5 pb-6 pt-7 text-white"
    >
      {children}
    </motion.div>
  )
}

export function WarehouseHeader({
  eyebrow,
  title,
  right,
  prompt,
}: {
  eyebrow?: string
  title: string
  right?: ReactNode
  prompt?: string
}) {
  return (
    <div className="shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff9900]">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        </div>
        {right}
      </div>
      {prompt && <p className="mt-2 text-sm text-white/70">{prompt}</p>}
    </div>
  )
}

export function WarehouseButton({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: "primary" | "ghost"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-xl py-3.5 text-center text-[15px] font-bold outline-none transition-transform active:scale-[0.99] disabled:opacity-40",
        tone === "primary"
          ? "bg-[#ff9900] text-[#232f3e]"
          : "bg-white/10 text-white hover:bg-white/15",
      )}
    >
      {children}
    </button>
  )
}

function WarehouseChip({
  tone,
  children,
}: {
  tone: "ok" | "bad" | "hint"
  children: ReactNode
}) {
  const dot = tone === "ok" ? "bg-[#4ade80]" : tone === "bad" ? "bg-red-500" : "bg-[#ff9900]"
  return (
    <div className="mb-4 flex flex-col items-center gap-2 text-center">
      <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
      <p className="text-sm text-white/75">{children}</p>
    </div>
  )
}

/**
 * The graded warehouse footer. Mirrors the shared FeedbackFooter's state machine
 * (idle / nudge / correct / fail + Why) but in the warehouse theme. Emits the
 * identical engine actions, so the verdict, quota, and flame are untouched.
 */
export function WarehouseFooter({
  feedback,
  showWhy,
  canCheck,
  copy,
  dispatch,
}: {
  feedback: Feedback
  showWhy: boolean
  canCheck: boolean
  copy: { hint: string; nudge: string; correct: string; why: string }
  dispatch: Dispatch<LessonAction>
}) {
  return (
    <div className="mt-auto min-h-[128px] shrink-0 pt-3">
      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm text-white/55">{copy.hint}</p>
          <WarehouseButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </WarehouseButton>
        </>
      )}
      {feedback === "nudge" && (
        <>
          <WarehouseChip tone="hint">{copy.nudge}</WarehouseChip>
          <WarehouseButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </WarehouseButton>
        </>
      )}
      {feedback === "correct" && (
        <>
          <WarehouseChip tone="ok">{copy.correct}</WarehouseChip>
          <WarehouseButton onClick={() => dispatch({ type: "next" })}>Continue</WarehouseButton>
        </>
      )}
      {feedback === "fail" && (
        <>
          <WarehouseChip tone="bad">
            {showWhy ? copy.why : "Not quite. Tap Why for the answer, or reattempt."}
          </WarehouseChip>
          <div className="flex gap-3">
            <WarehouseButton tone="ghost" disabled={showWhy} onClick={() => dispatch({ type: "reveal" })}>
              Why?
            </WarehouseButton>
            <WarehouseButton onClick={() => dispatch({ type: "reattempt" })}>
              Reattempt
            </WarehouseButton>
          </div>
        </>
      )}
    </div>
  )
}
