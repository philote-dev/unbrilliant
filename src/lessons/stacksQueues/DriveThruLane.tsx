import type { Dispatch } from "react"
import { Check, UtensilsCrossed, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Feedback, LessonAction, QuestionCopy } from "@/features/lesson/engine"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { carFor, type DriveThruCar } from "./driveThruCars"
import { RealWorldFooter } from "./RealWorldFooter"

/**
 * The drive-thru skin for the queue real-world predict, the PRIMARY queue
 * real-world skin (PrinterShowpiece stays the fallback behind the Stage's
 * REALWORLD_QUEUE_SKIN switch). A full-bleed scene that turns the whole page into
 * a drive-thru: a restaurant with a pickup window at the FRONT, an asphalt lane
 * with markings, and top-down car sprites queued bumper to bumper. Cars roll IN
 * from the BACK (bottom) and the front car (at the window) is served first. This
 * is FIFO made literal: the car that arrived first reaches the window first.
 *
 * The car at the window is the queue verdict, so the dev-only data-answer hook
 * sits on the front car and grading is unchanged. Choreography is presentational
 * and driven by `popping` (the Stage flips it a beat AFTER the verdict): the
 * front car pulls away past the window, the rest roll up (Framer `layout`), and
 * the served car appears in the Served slot. Reduced motion snaps to the
 * end-state with no transitions. The themed footer (rendered when `dispatch` is
 * given) dispatches the same actions as the shared FeedbackFooter.
 */
export function DriveThruLane({
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
  cells: Cell[] // container order: index 0 = the front (at the window)
  arrival: string[] // arrival order, for the car catalogue identity
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  popping?: boolean
  reducedMotion?: boolean
  /** Integrated prompt, shown on the drive-thru order board. */
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
  const laneCells = leaving ? cells.filter((c) => c.id !== leaving.id) : cells
  const served = leaving ? [leaving] : []

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 340, damping: 30 }

  return (
    <motion.div
      data-testid="drivethru-lane"
      data-reduced-motion={reduced ? "1" : undefined}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className={cn("-mx-5 -mb-6 flex flex-1 flex-col bg-[#26282d]", className)}
    >
      {/* Restaurant facade with the brand, the prompt order board, and the window. */}
      <div className="shrink-0 bg-gradient-to-b from-[#d14b41] to-[#b73f37] px-5 pb-0 pt-4 text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-white/15">
              <UtensilsCrossed className="size-4" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-base font-extrabold tracking-tight">Willow Burgers</span>
          </div>
          <span className="rounded-full bg-[#f4a83a] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#3a2300]">
            Drive-thru
          </span>
        </div>

        {prompt && (
          <div className="mt-3 rounded-xl border border-amber-300/30 bg-[#1c1206] px-3 py-2.5 shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
              Order board
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-amber-50">{prompt}</p>
          </div>
        )}

        {/* Pickup window: the front car pulls up here. */}
        <div className="mt-3 flex items-end justify-center">
          <div className="flex w-28 flex-col items-center rounded-t-xl bg-white/95 px-3 pt-1.5 shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#b73f37]">
              Pickup
            </span>
            <span className="mt-1 h-2 w-20 rounded-t-md bg-sky-200/80" />
          </div>
        </div>
      </div>

      {/* The lane: asphalt with markings, cars queued front (top) to back (bottom). */}
      <div className="relative flex flex-1 flex-col items-center overflow-hidden bg-gradient-to-b from-[#34373d] to-[#24262b] px-5 pt-2">
        {/* lane markings: two dashed edge lines flanking the single-file lane */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/2 -ml-[62px] border-l-[3px] border-dashed border-amber-200/30" />
          <div className="absolute inset-y-0 left-1/2 ml-[62px] border-l-[3px] border-dashed border-amber-200/30" />
        </div>

        {/* Served: the car that just pulled away from the window. */}
        <div
          data-testid="drivethru-served"
          className="relative flex min-h-[26px] items-center justify-center"
        >
          <AnimatePresence initial={false}>
            {served.map((c) => (
              <motion.div
                key={c.id}
                data-cell={c.id}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={spring}
                className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1"
              >
                <CarSprite
                  body={carFor(c.id, arrival).accent[0]}
                  shade={carFor(c.id, arrival).accent[1]}
                  className="h-5 w-3.5"
                />
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  Served
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* The queue of cars, bumper to bumper. */}
        <div className="relative flex flex-col items-center gap-1 pt-1">
          <AnimatePresence initial={false} mode="popLayout">
            {laneCells.map((c, i) => (
              <Car
                key={c.id}
                cell={c}
                car={carFor(c.id, arrival)}
                atWindow={i === 0}
                state={cellState?.(c.id) ?? "default"}
                selectable={selectable}
                onSelect={() => onSelectCell?.(c.id)}
                isAnswer={answerId === c.id}
                reduced={reduced}
                spring={spring}
              />
            ))}
          </AnimatePresence>
        </div>

        <span className="relative mt-auto pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Cars join at the back
        </span>
      </div>

      {dispatch && copy && feedback !== undefined && (
        <RealWorldFooter
          variant="drivethru"
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
  selected: "ring-2 ring-white",
  correct: "ring-2 ring-emerald-400",
  nudge: "ring-2 ring-amber-400",
  fail: "ring-2 ring-red-400",
}

function Car({
  cell,
  car,
  atWindow,
  state,
  selectable,
  onSelect,
  isAnswer,
  reduced,
  spring,
}: {
  cell: Cell
  car: DriveThruCar
  atWindow: boolean
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
      aria-label={`${car.name} car, ${car.order}` + (atWindow ? ", at the window" : "")}
      initial={reduced ? false : { opacity: 0, y: 40, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -64, scale: 0.85 }}
      transition={spring}
      whileTap={selectable ? { scale: 0.97 } : undefined}
      className={cn(
        "relative block rounded-2xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a2d33]",
        selectable && "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "block rounded-2xl p-0.5",
          RING[state],
          atWindow && "shadow-[0_0_18px_rgba(244,168,58,0.55)]",
        )}
      >
        <CarSprite body={car.accent[0]} shade={car.accent[1]} className="h-[66px] w-[46px]" />
      </span>
      {state === "correct" && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="size-2.5" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

/** A clean top-down car sprite (pointing up toward the window) with a windshield,
 * rear window, headlights, and four wheels. Colour comes from the car catalogue. */
function CarSprite({
  body,
  shade,
  className,
}: {
  body: string
  shade: string
  className?: string
}) {
  return (
    <svg viewBox="0 0 48 72" className={className} aria-hidden>
      <ellipse cx="24" cy="67" rx="17" ry="4" fill="rgba(0,0,0,0.35)" />
      <rect x="7" y="3" width="34" height="63" rx="13" fill={body} />
      <rect x="10" y="22" width="28" height="30" rx="8" fill={shade} opacity="0.55" />
      <path d="M13 23 Q24 16 35 23 L32 31 Q24 27 16 31 Z" fill="#d7ecff" opacity="0.95" />
      <path d="M16 45 Q24 49 32 45 L34 53 Q24 58 14 53 Z" fill="#d7ecff" opacity="0.85" />
      <rect x="11" y="4.5" width="6" height="3" rx="1.5" fill="#fff7d6" />
      <rect x="31" y="4.5" width="6" height="3" rx="1.5" fill="#fff7d6" />
      <rect x="11" y="61" width="6" height="2.5" rx="1.25" fill="#7a1410" />
      <rect x="31" y="61" width="6" height="2.5" rx="1.25" fill="#7a1410" />
      <rect x="3" y="15" width="6" height="13" rx="3" fill="#15181d" />
      <rect x="39" y="15" width="6" height="13" rx="3" fill="#15181d" />
      <rect x="3" y="42" width="6" height="13" rx="3" fill="#15181d" />
      <rect x="39" y="42" width="6" height="13" rx="3" fill="#15181d" />
    </svg>
  )
}
