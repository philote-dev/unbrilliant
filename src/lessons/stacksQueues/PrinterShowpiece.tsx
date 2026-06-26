import type { Dispatch } from "react"
import { Check, FileText, Printer, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Feedback, LessonAction, QuestionCopy } from "@/features/lesson/engine"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { RealWorldFooter } from "./RealWorldFooter"

/**
 * The print-queue skin for the queue real-world predict (the primary, and only,
 * queue real-world skin). A full-bleed scene that turns the whole page into a
 * grey, minimal office printer: a clean machine at the top with a job display and
 * a paper-output tray, and a single-file queue of documents below feeding up into
 * it. Documents traverse the machine in arrival order, and the FRONT document (at
 * the intake) prints first. This is FIFO made literal: the file sent first reaches
 * the printer first.
 *
 * The front document is the queue verdict, so the dev-only data-answer hook sits
 * on it and grading is unchanged. Choreography is presentational and driven by
 * `popping` (the Stage flips it a beat AFTER the verdict): the front document
 * feeds up into the machine, the rest roll forward (Framer `layout`), and the
 * printed sheet drops into the output tray. Reduced motion snaps to the end-state.
 * The themed footer (rendered when `dispatch` is given) dispatches the same
 * actions as the shared FeedbackFooter.
 */

/** Subtle per-document tab colors (by arrival position) so the eye can track a
 * sheet as it moves; the machine itself stays grey and minimal. */
const DOC_ACCENTS = ["#3b82f6", "#ef6c3b", "#22a06b", "#d4a017", "#8b5cf6"]

export function PrinterShowpiece({
  cells,
  arrival,
  selectable,
  cellState,
  onSelectCell,
  answerId,
  popping = false,
  reducedMotion,
  prompt,
  feedback,
  showWhy,
  canCheck,
  copy,
  dispatch,
  className,
}: {
  cells: Cell[] // container order: index 0 = the front (next to print)
  arrival: string[] // arrival order, for stable per-document tab colors
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  popping?: boolean
  reducedMotion?: boolean
  /** Integrated prompt, shown on the printer's job display. */
  prompt?: string
  /** Themed footer state (rendered only when dispatch is provided). */
  feedback?: Feedback
  showWhy?: boolean
  canCheck?: boolean
  copy?: QuestionCopy
  dispatch?: Dispatch<LessonAction>
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const leaving = popping && answerId ? cells.find((c) => c.id === answerId) : undefined
  const queueCells = leaving ? cells.filter((c) => c.id !== leaving.id) : cells
  const printed = leaving ? [leaving] : []

  const accentOf = (id: string) =>
    DOC_ACCENTS[Math.max(0, arrival.indexOf(id)) % DOC_ACCENTS.length]

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 340, damping: 30 }

  return (
    <motion.div
      data-testid="printer-showpiece"
      data-reduced-motion={reduced ? "1" : undefined}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className={cn(
        "-mx-5 -mb-6 flex flex-1 flex-col bg-gradient-to-b from-[#e7e8ec] to-[#cdd0d5]",
        className,
      )}
    >
      {/* The printer machine: a minimal grey body with the job display + output slot. */}
      <div className="shrink-0 px-5 pt-5">
        <div className="mx-auto w-full max-w-[300px]">
          {/* lid */}
          <div className="mx-4 h-2 rounded-t-lg bg-[#a7abb2]" />
          {/* body */}
          <div className="rounded-2xl bg-gradient-to-b from-[#d2d5da] to-[#b0b4ba] p-3 shadow-[0_12px_26px_-14px_rgba(0,0,0,0.55)] ring-1 ring-black/10">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Printer className="size-4 text-neutral-700" strokeWidth={2.4} aria-hidden />
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                  Willow Print
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                <span
                  className={cn(
                    "size-2 rounded-full bg-emerald-500",
                    reduced ? "" : "animate-pulse",
                  )}
                  aria-hidden
                />
                {printed.length > 0 ? "Printing" : "Ready"}
              </span>
            </div>

            {prompt && (
              <div className="mt-2.5 rounded-lg bg-[#eef0f3] px-3 py-2 ring-1 ring-inset ring-black/10">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                  Print job
                </p>
                <p className="mt-0.5 text-[13px] font-semibold leading-snug text-neutral-800">
                  {prompt}
                </p>
              </div>
            )}

            {/* the paper-output slot the printed sheet emerges from */}
            <div className="mt-3 h-1.5 rounded-full bg-[#15181d]/75 shadow-inner" />
          </div>
        </div>
      </div>

      {/* Output tray: the sheet that just printed. */}
      <div
        data-testid="printer-output"
        className="relative flex min-h-[30px] items-center justify-center px-5 pt-2"
      >
        <AnimatePresence initial={false}>
          {printed.map((c) => (
            <motion.div
              key={c.id}
              data-cell={c.id}
              initial={reduced ? false : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={spring}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1"
            >
              <FileText className="size-3.5 text-emerald-600" strokeWidth={2.5} aria-hidden />
              <span className="text-[11px] font-bold text-neutral-700">{c.label}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                Printed
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* The queue: documents waiting to print, front (next) at the top. */}
      <div className="relative flex flex-1 flex-col items-center gap-1.5 overflow-hidden px-5 pt-1">
        <AnimatePresence initial={false} mode="popLayout">
          {queueCells.map((c, i) => (
            <DocSheet
              key={c.id}
              cell={c}
              accent={accentOf(c.id)}
              front={i === 0}
              state={cellState?.(c.id) ?? "default"}
              selectable={selectable}
              onSelect={() => onSelectCell?.(c.id)}
              isAnswer={answerId === c.id}
              reduced={reduced}
              spring={spring}
            />
          ))}
        </AnimatePresence>

        <span className="mt-auto pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Documents join at the back
        </span>
      </div>

      {dispatch && copy && feedback !== undefined && (
        <RealWorldFooter
          variant="printer"
          feedback={feedback}
          showWhy={!!showWhy}
          canCheck={!!canCheck}
          copy={copy}
          dispatch={dispatch}
        />
      )}
    </motion.div>
  )
}

const RING: Record<AnswerState, string> = {
  default: "ring-2 ring-transparent",
  selected: "ring-2 ring-[#3b82f6]",
  correct: "ring-2 ring-emerald-500",
  nudge: "ring-2 ring-amber-500",
  fail: "ring-2 ring-red-500",
}

function DocSheet({
  cell,
  accent,
  front,
  state,
  selectable,
  onSelect,
  isAnswer,
  reduced,
  spring,
}: {
  cell: Cell
  accent: string
  front: boolean
  state: AnswerState
  selectable?: boolean
  onSelect?: () => void
  isAnswer?: boolean
  reduced: boolean
  spring: object
}) {
  return (
    <motion.button
      type="button"
      layout={reduced ? false : "position"}
      data-cell={cell.id}
      data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
      disabled={!selectable}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={state === "selected"}
      aria-label={`${cell.label} document`}
      initial={reduced ? false : { opacity: 0, y: 36, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -64, scale: 0.9 }}
      transition={spring}
      whileTap={selectable ? { scale: 0.98 } : undefined}
      className={cn(
        "relative block w-full max-w-[280px] rounded-xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#3b82f6]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#d5d8dc]",
        selectable && "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "block rounded-xl p-0.5",
          RING[state],
          front && "shadow-[0_0_16px_rgba(59,130,246,0.35)]",
        )}
      >
        <DocumentSprite label={cell.label} accent={accent} />
      </span>
      {state === "correct" && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="size-2.5" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

/** A clean sheet of paper: a white page with a colored corner tab, the file name,
 * and a couple of faint text lines. Decorative; the button owns label + behaviour. */
function DocumentSprite({ label, accent }: { label: string; accent: string }) {
  return (
    <span className="relative flex h-14 w-full items-center gap-2.5 overflow-hidden rounded-lg bg-white px-3 shadow-sm ring-1 ring-black/10">
      <span
        aria-hidden
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[13px] font-bold text-neutral-800">{label}</span>
        <span aria-hidden className="flex flex-col gap-1">
          <span className="h-1 w-20 rounded-full bg-neutral-200" />
          <span className="h-1 w-14 rounded-full bg-neutral-200" />
        </span>
      </span>
      <FileText className="size-5 shrink-0 text-neutral-300" strokeWidth={2} aria-hidden />
    </span>
  )
}
