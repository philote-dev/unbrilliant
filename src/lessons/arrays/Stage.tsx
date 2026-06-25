import { type Dispatch, type ReactNode } from "react"
import { Check, Shuffle, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import type { LessonAction } from "@/features/lesson/engine"
import {
  currentPartArrays,
  isTerminalA,
  partQuotaArrays,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { ParkingLot, type ParkingScene } from "./ParkingLot"

/**
 * The Arrays stage, skinned as a FULL-SCREEN aerial parking lot (the PlaylistQueue
 * immersion pattern): a negative-margin, edge-to-edge dark tarmac surface fills
 * the whole stage, with parking signage, the numbered lot as the hero, an entrance
 * /exit aisle, and a themed footer. The lot transforms the page rather than
 * sitting in a card. The verdict UX is preserved exactly: the MCQ keeps the shared
 * AnswerCard (with answerMarker), the CostReadout renders the engine's q.cost
 * verbatim (locked house words), the footer dispatches the same actions, and the
 * access Continue button stays. The ParkingLot owns the deterministic, reveal-gated
 * choreography and the aria-live result; nothing here recomputes a verdict.
 */
export function ArraysStage({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  return currentPartArrays(state) === "access" ? (
    <AccessPart state={state} dispatch={dispatch} />
  ) : (
    <PredictPart state={state} dispatch={dispatch} />
  )
}

function AccessPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const accessed = state.accessed

  return (
    <LotScene quota={null}>
      <h2 className="mt-3 text-center text-lg font-extrabold tracking-tight">
        Arrays: instant access
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-center text-sm text-white/65">
        {q.prompt}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-3">
        <ParkingLot
          bare
          scene={{
            kind: "access",
            cars: q.array,
            pinned: accessed,
            onPark: (i) => dispatch({ type: "select", letter: String(i) }),
            cost: q.cost,
          }}
        />
        {accessed != null && (
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        )}
      </div>

      <DriveAisle />

      <div className="mt-3">
        {accessed != null && (
          <p className="mb-3 text-center text-sm text-white/70">
            Bay {accessed} holds {q.array[accessed]}. A direct hit: pull straight
            in, no matter how big the lot grows.
          </p>
        )}
        <SignButton onClick={() => dispatch({ type: "continue" })}>Continue</SignButton>
      </div>
    </LotScene>
  )
}

function PredictPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const quota = partQuotaArrays(state)
  const terminal = isTerminalA(state)
  // The lot's wave reveals the resulting arrangement, so it fires only AFTER the
  // verdict: on a correct answer, or on a fail once the learner taps Why.
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === q.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      // The learner's own wrong pick reads red; the correct answer is revealed
      // (in green) only once they ask Why. Never auto-revealed on the miss.
      if (showWhy && id === q.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  const scene: ParkingScene | null = q.resize
    ? { kind: "resize", cars: q.array, resize: q.resize, reveal, cost: q.cost }
    : q.op
      ? { kind: "shift", cars: q.array, op: q.op, reveal, cost: q.cost }
      : null

  return (
    <LotScene quota={quota}>
      <h2 className="mx-auto mt-3 max-w-sm text-center text-base font-bold leading-snug">
        {q.prompt}
      </h2>
      {/* Re-roll a fresh instance. Gated to the pristine idle state so it can
          never dodge a graded verdict or the until-correct mastery wall. */}
      {feedback === "idle" && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => dispatch({ type: "reattempt" })}
            aria-label="Regenerate this example"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white/80 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#23262d]"
          >
            <Shuffle className="size-3.5" /> New example
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
        {scene && <ParkingLot bare scene={scene} />}
        {reveal && (
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        )}
      </div>

      <DriveAisle />

      <div className="mt-3 flex flex-col gap-2.5">
        {q.options.map((opt, i) => (
          <AnswerCard
            key={opt.id}
            letter={String.fromCharCode(65 + i)}
            label={opt.label}
            state={cardState(opt.id)}
            disabled={terminal}
            answerMarker={opt.id === q.answer}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
          />
        ))}
      </div>

      <ArraysFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        copy={{ hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </LotScene>
  )
}

/* ------------------------------ themed scene ------------------------------- */

/** The full-bleed dark-tarmac surface: cancels the host's px-5/pb-6 padding to go
 * edge-to-edge, paints speckled asphalt, and tops it with parking signage. */
function LotScene({
  quota,
  children,
}: {
  quota: { done: number; total: number } | null
  children: ReactNode
}) {
  const reduced = useReducedMotion() ?? false
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-6 text-white"
      style={{
        backgroundColor: "#23262d",
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.4px), linear-gradient(180deg, #2c313b, #1f232a)",
        backgroundSize: "7px 7px, 100% 100%",
      }}
    >
      <LotSignage quota={quota} />
      {children}
    </motion.div>
  )
}

function LotSignage({ quota }: { quota: { done: number; total: number } | null }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-lg text-xl font-black text-white shadow-md ring-1 ring-white/25"
          style={{ backgroundColor: "#2563eb" }}
        >
          P
        </span>
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight">Willow Parking</p>
          <p className="text-[11px] text-white/55">Bay number = index</p>
        </div>
      </div>
      {quota && (
        <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-neutral-900 shadow">
          {quota.done} / {quota.total}
        </span>
      )}
    </div>
  )
}

/** The entrance/exit drive aisle: a dashed yellow lane line bracketed by IN/OUT
 * signage, so the lot reads as a real lot you drive into. Decorative only. */
function DriveAisle() {
  return (
    <div aria-hidden className="my-1 flex items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
        Entrance
      </span>
      <span
        className="h-0.5 flex-1 rounded-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(250,204,21,0.55) 0 10px, transparent 10px 20px)",
        }}
      />
      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
        Exit
      </span>
    </div>
  )
}

/* ------------------------------ themed footer ------------------------------ */

/** The themed verdict footer: same actions and button names as the shared
 * FeedbackFooter (Check / Continue / Why? / Reattempt), restyled for the tarmac.
 * Result is carried by an icon badge + text here, the CostReadout's house word,
 * and the lot's aria-live announcement, never by colour alone. */
function ArraysFooter({
  feedback,
  selected,
  showWhy,
  copy,
  dispatch,
}: {
  feedback: ArraysState["feedback"]
  selected: string | null
  showWhy: boolean
  copy: { hint: string; nudge: string; correct: string; why: string }
  dispatch: Dispatch<LessonAction>
}) {
  return (
    <div className="mt-4 min-h-[128px]">
      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm text-white/65">{copy.hint}</p>
          <SignButton disabled={selected == null} onClick={() => dispatch({ type: "check" })}>
            Check
          </SignButton>
        </>
      )}

      {feedback === "nudge" && (
        <>
          <FooterChip tone="nudge" text={copy.nudge} />
          <SignButton disabled={selected == null} onClick={() => dispatch({ type: "check" })}>
            Check
          </SignButton>
        </>
      )}

      {feedback === "correct" && (
        <>
          <FooterChip tone="correct" text={copy.correct} />
          <SignButton onClick={() => dispatch({ type: "next" })}>Continue</SignButton>
        </>
      )}

      {feedback === "fail" && (
        <>
          <FooterChip
            tone="fail"
            text={showWhy ? copy.why : "Not quite. Tap Why for the answer, or reattempt."}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
              className="flex-1 rounded-full bg-white/10 py-3.5 text-center text-[15px] font-semibold text-white outline-none transition-colors hover:bg-white/15 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#23262d]"
            >
              Why?
            </button>
            <SignButton className="flex-1" onClick={() => dispatch({ type: "reattempt" })}>
              Reattempt
            </SignButton>
          </div>
        </>
      )}
    </div>
  )
}

function SignButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-full bg-amber-400 py-3.5 text-center text-[15px] font-bold text-neutral-900 outline-none transition-transform active:scale-[0.99] disabled:opacity-40",
        "focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#23262d]",
        className,
      )}
    >
      {children}
    </button>
  )
}

function FooterChip({
  tone,
  text,
}: {
  tone: "correct" | "nudge" | "fail"
  text: string
}) {
  const badge =
    tone === "correct"
      ? { cls: "bg-emerald-400 text-neutral-900", icon: <Check className="size-3.5" strokeWidth={3} /> }
      : tone === "fail"
        ? { cls: "bg-rose-500 text-white", icon: <X className="size-3.5" strokeWidth={3} /> }
        : { cls: "bg-amber-400 text-neutral-900", icon: <span className="text-xs font-black leading-none">!</span> }
  return (
    <div className="mb-3 flex flex-col items-center gap-1.5 text-center">
      <span aria-hidden className={cn("flex size-6 items-center justify-center rounded-full", badge.cls)}>
        {badge.icon}
      </span>
      <p className="text-sm text-white/75">{text}</p>
    </div>
  )
}
