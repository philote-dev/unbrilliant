import { useEffect, useState, type Dispatch, type ReactNode } from "react"
import { Check, Info, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useOptionalTheme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import type { AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StatusChip } from "@/components/willow/StatusChip"
import type { LessonAction } from "@/features/lesson/engine"
import {
  binQuotaHeaps,
  buildMotionFrames,
  currentPartHeaps,
  isTerminalHeaps,
  leftIndex,
  nextSwap,
  nodeMotionFrames,
  partQuotaHeaps,
  rightIndex,
  siftUp,
  slotId,
  slotIndexOf,
  synthesisPhase,
  type BuildMotionFrame,
  type HeapBin,
  type HeapCost,
  type HeapMotionOp,
  type HeapsQuestion,
  type HeapsState,
  type SwapStep,
  type SynthesisPhase,
} from "@/features/lesson/heapsEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { HeapDualView, type HeapFigureRenderer, type SlotTone } from "./HeapDualView"
import { ERTriageBoard, PATIENT_ICON } from "./ERTriageBoard"
import { patientFor, triageTier } from "./triagePatients"
import { MonitorMasthead } from "./MonitorChrome"

const LETTERS = ["A", "B", "C", "D"]
const BIN_LABEL: Record<HeapBin, string> = {
  siftUp: "Sift up",
  siftDown: "Sift down",
  mapping: "Mapping",
  contrast: "Contrast",
  build: "Build",
  synthesis: "ER synthesis",
}

/** The two synced figures the replay/idle views can render through `renderFigure`. */
const defaultFigure: HeapFigureRenderer = (props) => <HeapDualView {...props} />
/** The promoted ER look: theme-aware (white+red / black+red), red highlights, tiers. */
const triageFigure: HeapFigureRenderer = (props) => (
  <ERTriageBoard {...props} surface="auto" accent="red" tier />
)
/** A tighter dual view for predict beats, so the answer cards sit higher. */
const compactFigure: HeapFigureRenderer = (props) => <HeapDualView {...props} compact />

/**
 * The ER triage monitor surface, theme-aware (the promoted look): white + red in
 * light (clean clinical), near-black + red in dark, with a faint red top glow. The
 * board, masthead, and chrome all read the same coat so the live ER beats follow
 * the app theme instead of the old fixed dark monitor.
 */
type MonitorMode = "light" | "dark"
interface MonitorSkin {
  bg: string
  ink: string
  sub: string
  faint: string
  hairline: string
  panel: string
  red: string
  redSoft: string
  btnBg: string
  btnInk: string
  ringOffset: string
}
function erMonitorSkin(mode: MonitorMode): MonitorSkin {
  return mode === "light"
    ? {
        bg: "radial-gradient(120% 70% at 50% -10%, rgba(229,52,58,0.07), transparent 60%), linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%)",
        ink: "#0f1115",
        sub: "#475569",
        faint: "#94a3b8",
        hairline: "#e3e7ee",
        panel: "#ffffff",
        red: "#e5343a",
        redSoft: "rgba(229,52,58,0.12)",
        btnBg: "#0f1115",
        btnInk: "#ffffff",
        ringOffset: "#ffffff",
      }
    : {
        bg: "radial-gradient(120% 70% at 50% -10%, rgba(251,90,96,0.14), transparent 60%), linear-gradient(180deg, #0b1220 0%, #0e1626 60%, #0b1220 100%)",
        ink: "#e6e8ec",
        sub: "#94a3b8",
        faint: "#6b7280",
        hairline: "rgba(255,255,255,0.10)",
        panel: "rgba(255,255,255,0.03)",
        red: "#fb5a60",
        redSoft: "rgba(251,90,96,0.16)",
        btnBg: "#e6e8ec",
        btnInk: "#0b0d12",
        ringOffset: "#0b0d12",
      }
}

export function HeapsStage({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const part = currentPartHeaps(state)
  switch (part) {
    case "demo":
      return <DemoPart state={state} dispatch={dispatch} />
    case "teach-array":
      return <TeachArrayPart state={state} dispatch={dispatch} />
    case "teach-rule":
      return <TeachRulePart state={state} dispatch={dispatch} />
    case "watched-build":
      return <WatchedBuildPart state={state} dispatch={dispatch} />
    case "build-a-heap":
      return <BuildAHeapPart state={state} dispatch={dispatch} />
    case "teach-extract":
      return <TeachExtractPart state={state} dispatch={dispatch} />
    case "map-child":
    case "map-parent":
    case "contrast-samedata":
      return <SlotLocatePart state={state} dispatch={dispatch} />
    case "siftup-skin":
      return <ERExtractPart state={state} dispatch={dispatch} />
    case "er-synthesis":
      return <ERSynthesisPart state={state} dispatch={dispatch} />
    case "siftup-1":
    case "siftup-2":
    case "siftdown-1":
    case "siftdown-2":
      return <DoTheSiftPart state={state} dispatch={dispatch} />
    default:
      return <ArrangementPart state={state} dispatch={dispatch} />
  }
}

/* -------------------------------- shared bits ------------------------------- */

/** The house teach/intro kicker: a small, wide-tracked lilac eyebrow. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong">
      {children}
    </p>
  )
}

function BinHeader({ state }: { state: HeapsState }) {
  const q = state.question
  const quota = partQuotaHeaps(state)
  const bin = binQuotaHeaps(state)
  return (
    <div className="mt-7">
      {quota && bin && (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          {BIN_LABEL[bin.bin]} · {quota.done} / {quota.total} correct
        </p>
      )}
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">
        {q?.prompt}
      </h2>
    </div>
  )
}

const feedbackCopy = (q: HeapsQuestion) => ({
  prompt: q.prompt,
  hint: q.hint,
  nudge: q.nudge,
  correct: q.correct,
  why: q.why,
})

function LabeledCost({ label, cost }: { label: string; cost: HeapCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <CostReadout word={cost.word} count={cost.count} unit={cost.unit} />
    </div>
  )
}

function givenSentence(q: HeapsQuestion): string {
  const base = `The heap, top to bottom, is ${q.heap.join(", ")}.`
  if (q.insertKey != null) return `${base} You will insert ${q.insertKey} and predict the sift-up.`
  if (q.extracted != null) return `${base} You will extract the top (${q.extracted}) and predict the sift-down.`
  return base
}

/* ------------------------------- step replay ------------------------------- */

/** The op a replay animates, derived from the question (insert sift-up / extract). */
function motionOpOf(q: HeapsQuestion): HeapMotionOp | null {
  if (q.insertKey != null) return { kind: "insert", heap: q.heap, key: q.insertKey }
  if (q.extracted != null) return { kind: "extract", heap: q.heap }
  return null
}

/** One precomputed frame of a sift replay: the arrangement to show (drives the
 * traveling-node motion in HeapDualView), the slots to emphasise, the swap pair
 * (the ER skin still lifts off it), the caption, and the screen-reader sentence. */
interface ReplayFrame {
  heap: number[]
  highlight: number[]
  movingPair: SwapStep | null
  caption: string
  srLabel: string
}

/**
 * Expand a heap op into the ordered replay frames, consuming the engine's pure
 * `nodeMotionFrames` (the traveling-node data). The arrangement per frame is what
 * makes a value travel between slots in HeapDualView; the moving pair is kept so
 * the ER skin can still lift. The extract setup frame reads as the root leaving and
 * the last leaf about to fill it; the hand-off frame lands the filler on top.
 */
function replayFrames(op: HeapMotionOp): ReplayFrame[] {
  const frames = nodeMotionFrames(op)
  const final = frames[frames.length - 1].heap
  const swaps = frames.filter((f) => f.movingPair != null).length
  const sift =
    swaps === 0
      ? `No swaps needed. Final arrangement ${final.join(", ")}.`
      : `${swaps} swap${swaps === 1 ? "" : "s"}: it settles at ${final.join(", ")}.`

  return frames.map((frame, idx) => {
    if (op.kind === "extract" && idx === 0) {
      const n = op.heap.length
      const caption = `Take the top out (${op.heap[0]}). To keep the array packed with no gaps, the last item (${op.heap[n - 1]}) moves up to fill the root, then it sinks.`
      return { heap: frame.heap, highlight: [0, n - 1], movingPair: null, caption, srLabel: caption }
    }
    if (frame.handoff != null) {
      const filler = frame.handoff.filler
      return {
        heap: frame.heap,
        highlight: [0],
        movingPair: null,
        caption: `${filler} is now on top. Sink it past anything more urgent.`,
        srLabel: sift,
      }
    }
    if (frame.movingPair != null) {
      return {
        heap: frame.heap,
        highlight: [frame.movingPair.a, frame.movingPair.b],
        movingPair: frame.movingPair,
        caption: `Swap slots ${frame.movingPair.a} and ${frame.movingPair.b}.`,
        srLabel: sift,
      }
    }
    // The insert setup frame: the new key has dropped into the next open slot.
    const dropSlot = frame.heap.length - 1
    return {
      heap: frame.heap,
      highlight: [dropSlot],
      movingPair: null,
      caption: op.kind === "insert" ? `${op.key} drops into the next open slot.` : "Starting heap.",
      srLabel: sift,
    }
  })
}

/**
 * The synced why-replay: a thin Heaps adapter over the shared FrameSequence. It
 * walks the engine's `nodeMotionFrames`, and each frame's arrangement drives the
 * traveling-node motion (HeapDualView keys nodes by value, so a swap springs the
 * node between slots in BOTH panels at once). The frame index is transient UI state
 * and never touches the verdict. Autoplay dwells on the setup frame (1000ms) then
 * advances each swap (820ms); any manual control hands the learner the scrubber and
 * Replay restarts. Reduced motion snaps to the end-state with no timers.
 * `renderFigure` lets a skin (the ER triage board, which still lifts off the moving
 * pair) swap the figure while keeping the identical frame math; it defaults to the
 * HeapDualView (the traveling-node signature).
 */
function StepReplay({
  op,
  reduced,
  renderFigure = defaultFigure,
  surface = "default",
}: {
  op: HeapMotionOp
  reduced: boolean
  renderFigure?: HeapFigureRenderer
  /** "clinical" themes the caption + Back/Next/Replay controls for the dark monitor. */
  surface?: "default" | "clinical"
}) {
  const clinical = surface === "clinical"
  const mode = useOptionalTheme()
  const stepBtn = clinical
    ? mode === "light"
      ? "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 focus-visible:ring-neutral-400/70 focus-visible:ring-offset-white"
      : "border-white/20 bg-white/[0.05] text-slate-100 hover:bg-white/10 focus-visible:ring-red-300/60 focus-visible:ring-offset-[#0b1220]"
    : undefined
  const replayBtn = clinical
    ? mode === "light"
      ? "bg-red-500/10 text-red-700 hover:bg-red-500/20 focus-visible:ring-red-400/60 focus-visible:ring-offset-white"
      : "bg-red-400/15 text-red-200 hover:bg-red-400/25 focus-visible:ring-red-300/60 focus-visible:ring-offset-[#0b1220]"
    : undefined

  return (
    <FrameSequence
      frames={replayFrames(op)}
      autoPlayMs={(i) => (i === 0 ? 1000 : 820)}
      controls
      reduced={reduced}
      stepButtonClassName={stepBtn}
      replayButtonClassName={replayBtn}
      counterClassName={clinical ? (mode === "light" ? "text-neutral-500" : "text-slate-400") : undefined}
    >
      {(frame) => (
        <>
          {renderFigure({
            heap: frame.heap,
            highlightSlots: frame.highlight,
            liftPair: reduced ? null : frame.movingPair,
            reducedMotion: reduced,
            srLabel: frame.srLabel,
          })}
          <p
            className={cn(
              "max-w-xs text-center text-xs",
              clinical
                ? mode === "light"
                  ? "text-neutral-600"
                  : "text-slate-300"
                : "text-muted-foreground",
            )}
          >
            {frame.caption}
          </p>
        </>
      )}
    </FrameSequence>
  )
}

/* ----------------------------- arrangement cards ---------------------------- */

const CARD_SURFACE: Record<AnswerState, string> = {
  default: "border-border bg-card hover:border-lilac-strong/45",
  selected: "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15",
  correct: "border-success bg-success-soft",
  nudge: "border-warning bg-warning-soft",
  fail: "border-danger bg-danger-soft",
}
const CARD_BADGE: Record<AnswerState, string> = {
  default: "bg-muted text-foreground",
  selected: "bg-lilac text-lilac-foreground",
  correct: "bg-success text-white",
  nudge: "bg-warning text-warning-foreground",
  fail: "bg-danger text-white",
}

/** Clinical-dark tone maps for the ER monitor candidate cards (same hooks, dark skin). */
const CARD_SURFACE_CLINICAL: Record<AnswerState, string> = {
  default: "border-white/12 bg-white/[0.04] hover:border-sky-300/50",
  selected: "border-sky-300 bg-sky-400/10 ring-2 ring-sky-300/25",
  correct: "border-emerald-400 bg-emerald-500/15",
  nudge: "border-amber-400 bg-amber-400/12",
  fail: "border-red-400 bg-red-500/15",
}
const CARD_BADGE_CLINICAL: Record<AnswerState, string> = {
  default: "bg-white/10 text-slate-200",
  selected: "bg-sky-400 text-slate-950",
  correct: "bg-emerald-400 text-slate-950",
  nudge: "bg-amber-400 text-slate-950",
  fail: "bg-red-500 text-white",
}

function ArrangementChips({ heap, clinical }: { heap: number[]; clinical?: boolean }) {
  return (
    <div className="flex items-end gap-1">
      {heap.map((v, i) => (
        <div key={`${i}-${v}`} className="flex flex-col items-center">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md border text-xs font-bold",
              clinical
                ? "border-white/15 bg-white/[0.06] text-slate-100"
                : "border-border bg-background text-foreground",
            )}
          >
            {v}
          </span>
          <span
            className={cn("mt-0.5 text-[8px] leading-none", clinical ? "text-slate-500" : "text-faint")}
          >
            {i}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * A candidate-arrangement card: compact array-row chips (per the locked decision)
 * beneath the one shared dual view, rather than a mini tree+array per candidate.
 * Replicates `AnswerCard`'s DEV `data-answer` hook + `answer-card` testid so the
 * e2e tracer picks the winner deterministically (AnswerCard can't host chip rows).
 * `clinical` re-skins it for the ER monitor WITHOUT touching the hooks/structure.
 */
function ArrangementCard({
  letter,
  heap,
  state,
  disabled,
  answerMarker,
  onSelect,
  clinical = false,
}: {
  letter: string
  heap: number[]
  state: AnswerState
  disabled?: boolean
  answerMarker?: boolean
  onSelect?: () => void
  clinical?: boolean
}) {
  const reduced = useReducedMotion() ?? false
  const surface = clinical ? CARD_SURFACE_CLINICAL : CARD_SURFACE
  const badge = clinical ? CARD_BADGE_CLINICAL : CARD_BADGE
  return (
    <motion.button
      type="button"
      data-testid="answer-card"
      data-answer={answerMarker && import.meta.env.DEV ? "1" : undefined}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={state === "selected"}
      whileTap={disabled || reduced ? undefined : { scale: 0.985 }}
      animate={state === "nudge" && !reduced ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeInOut" }}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left outline-none transition-colors",
        clinical
          ? "focus-visible:ring-2 focus-visible:ring-sky-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]"
          : "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-default",
        surface[state],
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          badge[state],
        )}
      >
        {letter}
      </span>
      <ArrangementChips heap={heap} clinical={clinical} />
      {state === "correct" && (
        <span
          className={cn(
            "absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full",
            clinical ? "bg-emerald-400 text-slate-950" : "bg-success text-white",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span
          className={cn(
            "absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full",
            clinical ? "bg-red-500 text-white" : "bg-danger text-white",
          )}
        >
          <X className="size-3.5" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

/* ----------------------------- arrangement beats ---------------------------- */

function DeCue({ q }: { q: HeapsQuestion }) {
  const text =
    q.insertKey != null
      ? `Insert ${q.insertKey}`
      : q.extracted != null
        ? `Extract the top (${q.extracted})`
        : null
  if (!text) return null
  return (
    <span className="rounded-full bg-lilac-soft px-3 py-1 text-sm font-semibold text-lilac-strong">
      {text}
    </span>
  )
}

function ArrangementBody({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const correct = feedback === "correct"
  const reveal = correct || (feedback === "fail" && showWhy)
  const terminal = isTerminalHeaps(state)
  const op = motionOpOf(q)

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === q.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      if (showWhy && id === q.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  return (
    <StageSplit
      header={<BinHeader state={state} />}
      figure={
        <>
          <div className="flex flex-col items-center gap-2 py-3 animate-fade-in">
            {reveal && op ? (
              <StepReplay op={op} reduced={reduced} renderFigure={compactFigure} />
            ) : (
              <>
                <HeapDualView
                  heap={q.heap}
                  compact
                  reducedMotion={reduced}
                  srLabel={givenSentence(q)}
                />
                <DeCue q={q} />
                {q.kind === "contrast-place" && (
                  <p className="max-w-xs text-center text-xs text-muted-foreground">
                    A heap places by <span className="concept">shape, then sift</span>,{" "}
                    <span className="concept" style={{ animationDelay: "450ms" }}>
                      not by value
                    </span>
                    .
                  </p>
                )}
              </>
            )}
          </div>

          {correct && q.cost && (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <LabeledCost label="Sift" cost={q.cost} />
              {q.sortCost && <LabeledCost label="Full sort" cost={q.sortCost} />}
            </div>
          )}
        </>
      }
      interaction={
        <>
          <div className="flex flex-col gap-3">
            {q.options.map((o, i) => (
              <ArrangementCard
                key={o.id}
                letter={LETTERS[i] ?? String(i + 1)}
                heap={o.heap}
                state={cardState(o.id)}
                disabled={terminal}
                answerMarker={o.id === q.answer}
                onSelect={() => dispatch({ type: "select", letter: o.id })}
              />
            ))}
          </div>

          <FeedbackFooter
            feedback={feedback}
            selected={selected}
            showWhy={showWhy}
            hideFailHint
            copy={feedbackCopy(q)}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}

function ArrangementPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  return <ArrangementBody state={state} dispatch={dispatch} />
}

/* ------------------------------ do-the-sift ------------------------------ */

/** The footer for an active sift: a quiet instruction while sifting, a nudge on a
 * wrong move, and the correction + Continue once the heap rule holds. */
function SiftFooter({
  state,
  q,
  dispatch,
}: {
  state: HeapsState
  q: HeapsQuestion
  dispatch: Dispatch<LessonAction>
}) {
  const { feedback } = state
  return (
    <div className="mt-auto min-h-[120px] pt-2">
      {feedback === "correct" ? (
        <div className="animate-fade-in">
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <StatusChip status="correct" />
            <p className="text-sm text-muted-foreground lg:text-base">{q.correct}</p>
          </div>
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "next" })}
          >
            Continue
          </Button>
        </div>
      ) : feedback === "nudge" ? (
        <div className="mb-4 flex flex-col items-center gap-2 text-center" role="status">
          <StatusChip status="hint" />
          <p className="text-sm text-muted-foreground lg:text-base">{q.nudge}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground lg:text-base">
          Perform each swap until the heap rule holds.
        </p>
      )}
    </div>
  )
}

/**
 * The active "do the sift" beats (siftup-1 / siftup-2 / siftdown-1 / siftdown-2):
 * the learner performs the swaps instead of picking an end-state. The heaps are
 * seeded-generated, so the figure may be a little wider on the "-2" reps. Tap a node
 * (its array cell or its tree node), then tap
 * its parent (insert) or its larger child (extract) to propose that swap; the engine
 * validates it (a correct swap travels the node and advances, a wrong one is a brief
 * nudge with no state change). Extract beats open with a one-shot hand-off in the
 * dual view (the top leaves, the last leaf rises to the root) before the learner
 * sinks it. Reduced motion skips the hand-off and snaps every swap.
 */
function DoTheSiftPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const beat = state.sift
  const { selected, feedback } = state
  const isExtract = q?.extracted != null

  // Sift-down opens by playing the extract hand-off once (root leaves, last leaf
  // rises) in the dual view, then hands the learner the interactive sink.
  const needHandoff = isExtract && !reduced && (beat?.step ?? 0) === 0 && feedback !== "correct"
  const [playing, setPlaying] = useState(needHandoff)
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setPlaying(false), 460)
    return () => clearTimeout(t)
  }, [playing])

  if (!q || !beat) return null

  const solved = feedback === "correct"
  const heldSlot = selected != null ? slotIndexOf(selected) : null
  const next = nextSwap(beat)
  const interactive = !playing && !solved

  const handleTap = (i: number): void => {
    if (!interactive) return
    // First tap holds a node; tapping it again releases it; tapping a second node
    // proposes the swap (the engine decides if it is the next correct move).
    if (heldSlot == null || heldSlot === i) {
      dispatch({ type: "select", letter: slotId(i) })
      return
    }
    dispatch({ type: "rewire", from: slotId(heldSlot), to: slotId(i) })
  }

  // During the hand-off, show the full pre-extract heap so the discharge reads; then
  // the working (post-hand-off) heap drives the interactive sink.
  const figureHeap = playing && isExtract ? q.heap : beat.heap
  const heldTone: SlotTone = feedback === "nudge" ? "nudge" : "selected"
  const moverSlot = next ? next.a : null // the node being sifted (always next.a)
  const highlight =
    interactive && heldSlot == null && moverSlot != null ? [moverSlot] : []

  const caption = playing
    ? `The top (${q.extracted}) is discharged; the last item rises to fill it.`
    : isExtract
      ? "Tap the new root, then its larger child, to sink it into place."
      : `Tap ${q.insertKey}, then its parent, to lift it into place.`

  const srLabel = solved
    ? q.correct
    : `Working heap: ${beat.heap.join(", ")}. ${
        isExtract
          ? "Sink the root: tap it, then its larger child."
          : "Lift the new node: tap it, then its parent."
      }`

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <HeapDualView
          heap={figureHeap}
          highlightSlots={highlight}
          selectedSlot={interactive && heldSlot != null ? heldSlot : null}
          selectedTone={heldTone}
          siftPair={interactive ? next : null}
          onTapSlot={interactive ? handleTap : undefined}
          onTapNode={interactive ? handleTap : undefined}
          reducedMotion={reduced}
          srLabel={srLabel}
        />
        <p className="max-w-xs text-center text-xs text-muted-foreground">{caption}</p>
      </div>

      <SiftFooter state={state} q={q} dispatch={dispatch} />
    </StageCenter>
  )
}

/* ------------------------------ build a heap ------------------------------ */

/** The insert sequence as a queue: placed keys settle green, the current one glows. */
function BuildKeyQueue({
  keys,
  placed,
  solved,
}: {
  keys: number[]
  placed: number
  solved: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden>
      {keys.map((k, i) => {
        const done = solved || i < placed
        const current = !solved && i === placed
        return (
          <span
            key={`${i}-${k}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border-2 text-xs font-bold transition-colors",
              done
                ? "border-success bg-success-soft text-foreground"
                : current
                  ? "border-lilac-strong bg-lilac-soft text-lilac-strong ring-4 ring-lilac-strong/15"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            {k}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Beat 7, build-a-heap (graded, the new `build` bin): the learner builds a valid
 * heap by inserting a fixed sequence of keys and performing every sift themselves.
 * It reuses the do-the-sift gesture per insert (tap the climbing key, then its
 * parent, to swap); the engine validates each swap, auto-settles any key that
 * needs none, drops in the next key, and grades the whole build once the last key
 * lands in a valid heap. Wrong sub-moves nudge (no fail wall). Reduced motion snaps
 * each swap, just like the single sift.
 */
function BuildAHeapPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const build = state.build
  const { selected, feedback } = state
  if (!q || !build) return null

  const beat = build.sift
  const solved = feedback === "correct"
  const interactive = !solved && beat != null
  const heldSlot = selected != null ? slotIndexOf(selected) : null
  const next = beat ? nextSwap(beat) : null
  const figureHeap = beat ? beat.heap : build.heap
  const moverSlot = next ? next.a : null
  const highlight = interactive && heldSlot == null && moverSlot != null ? [moverSlot] : []
  const heldTone: SlotTone = feedback === "nudge" ? "nudge" : "selected"
  const incoming = build.keys[build.placed]

  const handleTap = (i: number): void => {
    if (!interactive) return
    // First tap holds a node; tapping it again releases it; a second node proposes
    // the swap (the engine decides if it is the next correct move for this insert).
    if (heldSlot == null || heldSlot === i) {
      dispatch({ type: "select", letter: slotId(i) })
      return
    }
    dispatch({ type: "rewire", from: slotId(heldSlot), to: slotId(i) })
  }

  const caption = solved
    ? "Every parent beats its children. The heap is built."
    : `Tap ${incoming}, then its parent, to lift it into place.`
  const srLabel = solved
    ? q.correct
    : `Building the heap, so far ${figureHeap.join(", ")}. Lift ${incoming}: tap it, then its parent.`

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <BuildKeyQueue keys={build.keys} placed={build.placed} solved={solved} />
        <HeapDualView
          heap={figureHeap}
          highlightSlots={highlight}
          selectedSlot={interactive && heldSlot != null ? heldSlot : null}
          selectedTone={heldTone}
          siftPair={interactive ? next : null}
          onTapSlot={interactive ? handleTap : undefined}
          onTapNode={interactive ? handleTap : undefined}
          reducedMotion={reduced}
          srLabel={srLabel}
        />
        <p className="max-w-xs text-center text-xs text-muted-foreground">{caption}</p>
      </div>

      <SiftFooter state={state} q={q} dispatch={dispatch} />
    </StageCenter>
  )
}

/* ----------------------------- ER triage skin ----------------------------- */

/** The hero banner: the root patient (most urgent / being discharged), named for a
 * human touch (the board cards stay tiered). Theme-aware; decorative (the figure's
 * srLabel carries the board state for non-sighted learners). The severity chip is
 * the ER red, since the banner always shows the most-urgent patient. */
function MonitorBanner({
  label,
  sublabel,
  heap,
}: {
  label: string
  sublabel: string
  heap: number[]
}) {
  const skin = erMonitorSkin(useOptionalTheme())
  const p = patientFor(heap[0], heap)
  const Glyph = PATIENT_ICON[p.icon]
  return (
    <div
      aria-hidden
      className="mt-3 flex items-center gap-3 rounded-xl border p-2.5"
      style={{ borderColor: skin.hairline, background: skin.panel }}
    >
      <div className="flex flex-col leading-none">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: skin.red }}
        >
          {label}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-wide" style={{ color: skin.faint }}>
          {sublabel}
        </span>
      </div>
      <span
        className="flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-lg font-extrabold text-white"
        style={{ backgroundColor: skin.red }}
      >
        {p.severity}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-bold" style={{ color: skin.ink }}>
          {p.name}
        </p>
        <p className="text-[11px]" style={{ color: skin.sub }}>
          {triageTier(p.level).label} · Priority {p.level}
        </p>
      </div>
      <Glyph className="size-5 shrink-0" style={{ color: skin.red }} />
    </div>
  )
}

/** A cost readout with a clinical (themed) label for the monitor. */
function ClinicalCost({ label, cost }: { label: string; cost: HeapCost }) {
  const skin = erMonitorSkin(useOptionalTheme())
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: skin.sub }}
      >
        {label}
      </span>
      <CostReadout word={cost.word} count={cost.count} unit={cost.unit} />
    </div>
  )
}

/** The monitor CTA: a high-contrast clinical button (not red, to avoid reading as a
 * stop / danger control), themed so it inverts cleanly in light and dark. */
function MonitorButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  const skin = erMonitorSkin(useOptionalTheme())
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full py-3.5 text-center text-[15px] font-bold outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-40"
      style={{
        backgroundColor: skin.btnBg,
        color: skin.btnInk,
        ["--tw-ring-color" as string]: skin.red,
        ["--tw-ring-offset-color" as string]: skin.ringOffset,
      }}
    >
      {children}
    </button>
  )
}

const CHIP_TONE = {
  ok: { Icon: Check, light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/15 text-emerald-300" },
  bad: { Icon: X, light: "bg-red-100 text-red-700", dark: "bg-red-500/15 text-red-300" },
  hint: { Icon: Info, light: "bg-amber-100 text-amber-800", dark: "bg-amber-400/15 text-amber-300" },
} as const

/** Feedback chip: icon + text + a polite SR status (never colour alone). Theme-aware. */
function MonitorChip({ tone, text }: { tone: keyof typeof CHIP_TONE; text: string }) {
  const mode = useOptionalTheme()
  const skin = erMonitorSkin(mode)
  const { Icon, light, dark } = CHIP_TONE[tone]
  return (
    <div role="status" className="mb-4 flex flex-col items-center gap-2 text-center">
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          mode === "light" ? light : dark,
        )}
      >
        <Icon className="size-4" strokeWidth={3} />
      </span>
      <p className="text-sm" style={{ color: skin.sub }}>
        {text}
      </p>
    </div>
  )
}

/**
 * The clinical do-the-sift footer (ER extract + ER synthesis): a quiet instruction
 * while performing swaps, an amber nudge on a wrong move, and the correction +
 * Continue once the board holds. There is no Check / fail wall: do-the-sift commits
 * via swaps and only ever nudges, so the monitor mirrors the light SiftFooter.
 */
function ClinicalSiftFooter({
  state,
  q,
  instruction,
  dispatch,
}: {
  state: HeapsState
  q: HeapsQuestion
  instruction: string
  dispatch: Dispatch<LessonAction>
}) {
  const { feedback } = state
  const skin = erMonitorSkin(useOptionalTheme())
  return (
    <div className="mt-auto min-h-[132px] pt-2">
      {feedback === "correct" ? (
        <>
          <MonitorChip tone="ok" text={q.correct} />
          <MonitorButton onClick={() => dispatch({ type: "next" })}>Continue</MonitorButton>
        </>
      ) : feedback === "nudge" ? (
        <MonitorChip tone="hint" text={q.nudge} />
      ) : (
        <p className="text-center text-sm" style={{ color: skin.sub }}>
          {instruction}
        </p>
      )}
    </div>
  )
}

/** Tap-to-swap on the ER board: hold a patient, then tap their swap target. */
function erHandleTap(
  i: number,
  heldSlot: number | null,
  interactive: boolean,
  dispatch: Dispatch<LessonAction>,
): void {
  if (!interactive) return
  // First tap holds a patient; tapping the held one again releases it; a second
  // patient proposes the swap (the engine decides if it is the next correct move).
  if (heldSlot == null || heldSlot === i) {
    dispatch({ type: "select", letter: slotId(i) })
    return
  }
  dispatch({ type: "rewire", from: slotId(heldSlot), to: slotId(i) })
}

/**
 * The repurposed ER extract skin (`siftup-skin`): discharge the most urgent patient
 * as a do-the-sift on the full-screen clinical monitor. It reuses the engine's
 * single `sift` beat (an extract: the last patient already fills the top) and the
 * traveling-node ER board. The extract hand-off plays once (the top leaves, the
 * last patient rises) before the learner sinks the new top by tapping a patient,
 * then their more urgent child. Reduced motion skips the hand-off and snaps swaps.
 */
function ERExtractPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const skin = erMonitorSkin(useOptionalTheme())
  const beat = state.sift
  const { selected, feedback } = state

  const needHandoff = !reduced && (beat?.step ?? 0) === 0 && feedback !== "correct"
  const [playing, setPlaying] = useState(needHandoff)
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setPlaying(false), 460)
    return () => clearTimeout(t)
  }, [playing])

  if (!q || !beat) return null

  const solved = feedback === "correct"
  const heldSlot = selected != null ? slotIndexOf(selected) : null
  const next = nextSwap(beat)
  const interactive = !playing && !solved
  // During the hand-off, show the full pre-extract board; then the working board.
  const figureHeap = playing ? q.heap : beat.heap
  const heldTone: SlotTone = feedback === "nudge" ? "nudge" : "selected"
  const moverSlot = next ? next.a : null
  const highlight = interactive && heldSlot == null && moverSlot != null ? [moverSlot] : []

  const caption = playing
    ? `The most urgent patient (${q.extracted}) is discharged; the last patient rises to the top.`
    : "Tap the patient now on top, then their more urgent child, to sink them."
  const srLabel = solved
    ? q.correct
    : `Triage board: ${beat.heap.join(
        ", ",
      )}. Sink the patient on top: tap them, then their more urgent child.`

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-7"
      style={{ background: skin.bg, color: skin.ink }}
    >
      <StageCenter>
        <MonitorMasthead reduced={reduced} surface="auto" />
        <MonitorBanner label="Discharging" sublabel="top of board" heap={figureHeap} />
        <p className="mt-3 text-center text-sm" style={{ color: skin.sub }}>
          {q.prompt}
        </p>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
          <ERTriageBoard
            heap={figureHeap}
            surface="auto"
            accent="red"
            tier
            highlightSlots={highlight}
            selectedSlot={interactive && heldSlot != null ? heldSlot : null}
            selectedTone={heldTone}
            siftPair={interactive ? next : null}
            onTapSlot={interactive ? (i) => erHandleTap(i, heldSlot, interactive, dispatch) : undefined}
            onTapNode={interactive ? (i) => erHandleTap(i, heldSlot, interactive, dispatch) : undefined}
            reducedMotion={reduced}
            srLabel={srLabel}
          />
          <p className="max-w-xs text-center text-xs" style={{ color: skin.faint }}>
            {caption}
          </p>
        </div>

        {solved && q.cost && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <ClinicalCost label="Discharge" cost={q.cost} />
            {q.sortCost && <ClinicalCost label="Re-sort the board" cost={q.sortCost} />}
          </div>
        )}

        <ClinicalSiftFooter
          state={state}
          q={q}
          instruction="Perform each swap until the board holds."
          dispatch={dispatch}
        />
      </StageCenter>
    </motion.div>
  )
}

/** The three ER synthesis phases, for the progress rail + per-phase copy. */
const SYNTH_PHASES: { id: SynthesisPhase; label: string }[] = [
  { id: "admit", label: "Admit" },
  { id: "discharge", label: "Discharge" },
  { id: "retriage", label: "Re-triage" },
]

/** Per-phase caption (the figure cue) + footer instruction. */
function synthesisCopy(phase: SynthesisPhase | null): { caption: string; instruction: string } {
  if (phase === "admit")
    return {
      caption: "A new patient arrives. Tap them, then a neighbour they outrank, to lift them up.",
      instruction: "Admit: lift the new patient to their rank.",
    }
  if (phase === "discharge")
    return {
      caption:
        "The most urgent is discharged. Tap the patient now on top, then their more urgent child, to sink them.",
      instruction: "Discharge: sink the new top into place.",
    }
  if (phase === "retriage")
    return {
      caption:
        "A patient was re-assessed. Tap them, then the neighbour they should trade with, to re-sort the board.",
      instruction: "Re-triage: re-sift the re-assessed patient.",
    }
  return { caption: "The board holds through every operation.", instruction: "" }
}

/** A decorative rail of the three ER phases: the current one lit red, done ones
 * green, the rest quiet. Theme-aware so it reads on white or near-black. */
function SynthesisPhaseRail({ phase, solved }: { phase: SynthesisPhase | null; solved: boolean }) {
  const mode = useOptionalTheme()
  const skin = erMonitorSkin(mode)
  const activeIndex = solved ? SYNTH_PHASES.length : SYNTH_PHASES.findIndex((p) => p.id === phase)
  const doneCls =
    mode === "light"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
  return (
    <div aria-hidden className="mt-3 flex items-center justify-center gap-1.5">
      {SYNTH_PHASES.map((p, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <span
            key={p.id}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
              done && doneCls,
            )}
            style={
              done
                ? undefined
                : active
                  ? { borderColor: skin.red, background: skin.redSoft, color: skin.red }
                  : { borderColor: skin.hairline, background: skin.panel, color: skin.faint }
            }
          >
            {p.label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * The multi-step ER synthesis (`er-synthesis`, the new synthesis bin): one graded
 * slot that runs a sequence of ER operations on the clinical monitor. It drives the
 * engine's `synthesis` working model (admit + sift up, discharge + sift down,
 * re-triage + re-sift), reusing the do-the-sift gesture per op on the traveling-node
 * ER board. The phase rail tracks progress; a wrong sub-move nudges (no fail wall),
 * and the beat clears only when every op is performed into a valid board. Reduced
 * motion snaps each swap, just like the single sift.
 */
function ERSynthesisPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const skin = erMonitorSkin(useOptionalTheme())
  const synth = state.synthesis
  const { selected, feedback } = state
  if (!q || !synth) return null

  const beat = synth.sift
  const solved = feedback === "correct"
  const interactive = !solved && beat != null
  const heldSlot = selected != null ? slotIndexOf(selected) : null
  const next = beat ? nextSwap(beat) : null
  const figureHeap = beat ? beat.heap : synth.heap
  const moverSlot = next ? next.a : null
  const highlight = interactive && heldSlot == null && moverSlot != null ? [moverSlot] : []
  const heldTone: SlotTone = feedback === "nudge" ? "nudge" : "selected"
  const phase = synthesisPhase(synth)
  const { caption, instruction } = synthesisCopy(phase)
  const srLabel = solved
    ? q.correct
    : `ER board: ${figureHeap.join(", ")}. ${instruction}`

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-7"
      style={{ background: skin.bg, color: skin.ink }}
    >
      <StageCenter>
        <MonitorMasthead reduced={reduced} surface="auto" />
        <MonitorBanner label="ER board" sublabel="most urgent on top" heap={figureHeap} />
        <p className="mt-3 text-center text-sm" style={{ color: skin.sub }}>
          {q.prompt}
        </p>
        <SynthesisPhaseRail phase={phase} solved={solved} />

        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
          <ERTriageBoard
            heap={figureHeap}
            surface="auto"
            accent="red"
            tier
            highlightSlots={highlight}
            selectedSlot={interactive && heldSlot != null ? heldSlot : null}
            selectedTone={heldTone}
            siftPair={interactive ? next : null}
            onTapSlot={interactive ? (i) => erHandleTap(i, heldSlot, interactive, dispatch) : undefined}
            onTapNode={interactive ? (i) => erHandleTap(i, heldSlot, interactive, dispatch) : undefined}
            reducedMotion={reduced}
            srLabel={srLabel}
          />
          <p className="max-w-xs text-center text-xs" style={{ color: skin.faint }}>
            {solved ? "Every operation held the board valid." : caption}
          </p>
        </div>

        {solved && q.cost && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <ClinicalCost label="Run the board" cost={q.cost} />
            {q.sortCost && <ClinicalCost label="Re-sort each time" cost={q.sortCost} />}
          </div>
        )}

        <ClinicalSiftFooter state={state} q={q} instruction={instruction} dispatch={dispatch} />
      </StageCenter>
    </motion.div>
  )
}

/* ------------------------------- slot beats -------------------------------- */

function mapSentence(q: HeapsQuestion): string {
  if (q.dir === "parent")
    return `Slot ${q.slotIndex}'s parent is slot ${q.correctSlot}.`
  if (q.dir === "largerChild")
    return `Slot ${q.slotIndex}'s children are slots ${leftIndex(q.slotIndex ?? 0)} and ${rightIndex(
      q.slotIndex ?? 0,
    )}; the larger is slot ${q.correctSlot}.`
  return `Tree node ${q.slotIndex} is the same data as array cell ${q.slotIndex}.`
}

/**
 * The screen-reader label BEFORE the verdict: it restates the subject and the
 * task WITHOUT naming the target slot, so it never leaks the answer to a
 * non-sighted learner. The mapped slot is only voiced on reveal (mapSentence).
 */
function neutralSentence(q: HeapsQuestion): string {
  const subject = q.heap[q.slotIndex ?? 0]
  if (q.dir === "parent")
    return `Slot ${q.slotIndex} holds ${subject}. Tap the array cell you think is its parent.`
  if (q.dir === "largerChild")
    return `Slot ${q.slotIndex} holds ${subject}. Tap the array cell you think is its larger child.`
  return `A highlighted tree node holds ${subject}. Tap the array cell that stores the same data.`
}

function SlotLocatePart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalHeaps(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  const selectedSlot = selected != null ? slotIndexOf(selected) : null
  const selectedTone: SlotTone =
    feedback === "correct" ? "correct" : feedback === "nudge" ? "nudge" : feedback === "fail" ? "fail" : "selected"

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5 animate-fade-in">
        {/* De-cued: the subject's family connector (the answer arc + lit tree edge)
            is drawn ONLY on the post-commit reveal, so at idle the learner computes
            2i+1 / 2i+2 / (i-1)/2 instead of tracing a lit edge to the answer. */}
        <HeapDualView
          heap={q.heap}
          connectorSlot={reveal ? q.subjectSlot : null}
          treeSlot={q.treeSlot}
          highlightSlots={q.subjectSlot != null ? [q.subjectSlot] : []}
          selectedSlot={selectedSlot != null && selectedSlot >= 0 ? selectedSlot : null}
          selectedTone={selectedTone}
          revealSlot={reveal ? q.correctSlot : null}
          correctSlot={q.correctSlot}
          onTapSlot={terminal ? undefined : (i) => dispatch({ type: "select", letter: slotId(i) })}
          reducedMotion={reduced}
          srLabel={reveal ? mapSentence(q) : neutralSentence(q)}
        />
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Tap the <span className="concept">array slot</span>. The matching{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            tree node
          </span>{" "}
          lights up.
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/* ----------------------------- intro / teach ------------------------------- */

function ContinueButton({ dispatch, label = "Continue" }: { dispatch: Dispatch<LessonAction>; label?: string }) {
  return (
    <Button
      variant="tactile"
      size="lg"
      className="w-full"
      onClick={() => dispatch({ type: "continue" })}
    >
      {label}
    </Button>
  )
}

/** The pool the free-play sandbox draws from, in order (deterministic, no model). */
const SANDBOX_KEYS = [42, 17, 63, 28, 51, 90, 75, 34]

/**
 * Beat 1, the free-play insert sandbox (upgraded from the old scripted replay): the
 * learner builds a heap from nothing by inserting keys, one per tap. Each insert
 * appends the key at the next open slot and auto-sifts it up, played through the
 * shared traveling-node stepper so the tree and array move together. Clear empties
 * the board to build again. Ungraded: it advances on Continue. Reduced motion snaps
 * each insert to its settled heap.
 */
function DemoPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const [heap, setHeap] = useState<number[]>([])
  const [step, setStep] = useState(0)
  const [op, setOp] = useState<HeapMotionOp | null>(null)
  if (!q) return null
  const nextKey = SANDBOX_KEYS[step]
  const empty = heap.length === 0 && op == null

  const insert = () => {
    if (nextKey == null) return
    setOp({ kind: "insert", heap, key: nextKey })
    setHeap(siftUp(heap, nextKey).result)
    setStep((s) => s + 1)
  }
  const clear = () => {
    setHeap([])
    setStep(0)
    setOp(null)
  }

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Heaps</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
          Build a heap, the best on top
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          Tap <span className="concept">Insert</span> to drop a key in. It{" "}
          <span className="concept" style={{ animationDelay: "650ms" }}>
            sifts up
          </span>{" "}
          while it beats its parent. Tree and array move together.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        {empty ? (
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            An empty heap. Insert a key to start building.
          </p>
        ) : op ? (
          // Each insert remounts (fresh `key`) so the stepper restarts at the drop-in.
          <StepReplay key={step} op={op} reduced={reduced} />
        ) : (
          <HeapDualView
            heap={heap}
            reducedMotion={reduced}
            srLabel={`The heap is ${heap.join(", ")}.`}
          />
        )}
      </div>

      {/* Insert leads (tactile) so the learner plays; Clear rebuilds; once the pool
          is spent, Continue takes the lead. */}
      <div className="mt-auto flex flex-col gap-3">
        {nextKey != null ? (
          <Button variant="tactile" size="lg" className="w-full" onClick={insert}>
            Insert {nextKey}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            That is the whole pool. Clear to build a different heap.
          </p>
        )}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={clear}
            disabled={empty}
          >
            Clear
          </Button>
          <Button
            variant={nextKey != null ? "soft" : "tactile"}
            size="lg"
            className="flex-1"
            onClick={() => dispatch({ type: "continue" })}
          >
            Continue
          </Button>
        </div>
      </div>
    </StageCenter>
  )
}

/* ----------------------------- watched build ------------------------------ */

/** One frame's caption in the watched build: a key dropping, or climbing past a parent. */
function watchedCaption(frame: BuildMotionFrame): string {
  if (frame.movingPair == null) return `Insert ${frame.key} at the next open slot.`
  return `${frame.key} beats ${frame.heap[frame.movingPair.a]}, so it climbs.`
}

/** Which slots to light for a watched-build frame: the swapped pair, or the dropped key. */
function watchedHighlight(frame: BuildMotionFrame): number[] {
  if (frame.movingPair) return [frame.movingPair.a, frame.movingPair.b]
  return [frame.heap.length - 1]
}

/**
 * Beat 6, watched-build (teach, ungraded): auto-plays a heap being built from
 * scratch by repeated insert + sift up, end to end. It chains the engine's
 * `buildMotionFrames` through the shared `FrameSequence`, so every key drops in and
 * climbs in the synced dual view; Replay re-watches it. Reduced motion snaps to the
 * finished heap with no timers. Concept copy in the house reading style.
 */
function WatchedBuildPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q || !q.buildKeys) return null
  const frames = buildMotionFrames(q.buildKeys)

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Build a heap</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">Watch it built, key by key</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          A heap is just <span className="concept">insert</span>, repeated. Each key{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            drops in
          </span>
          , then{" "}
          <span className="concept" style={{ animationDelay: "900ms" }}>
            sifts up
          </span>{" "}
          while it beats its parent.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <FrameSequence
          frames={frames}
          autoPlayMs={(i) => (i === 0 ? 900 : 760)}
          controls
          reduced={reduced}
        >
          {(frame) => (
            <>
              <HeapDualView
                heap={frame.heap}
                highlightSlots={watchedHighlight(frame)}
                reducedMotion={reduced}
                srLabel={`Building the heap: ${frame.heap.join(", ")}.`}
              />
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                {watchedCaption(frame)}
              </p>
            </>
          )}
        </FrameSequence>

        {q.cost && q.sortCost && (
          <div className="flex flex-wrap justify-center gap-2">
            <LabeledCost label="Build" cost={q.cost} />
            <LabeledCost label="Full sort" cost={q.sortCost} />
          </div>
        )}
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

function TeachArrayPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const [slot, setSlot] = useState(1)
  if (!q) return null

  return (
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>Under the hood</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">
          It secretly lives in an array
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <HeapDualView
          heap={q.heap}
          connectorSlot={slot}
          highlightSlots={[slot]}
          onTapSlot={setSlot}
          reducedMotion={reduced}
          srLabel={`Slot ${slot}'s children are slots ${leftIndex(slot)} and ${rightIndex(slot)}; its parent is slot ${
            slot > 0 ? (slot - 1) >> 1 : 0
          }.`}
        />
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Tap any slot: its children are <span className="concept">2·i+1</span> and{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            2·i+2
          </span>
          ; its parent is{" "}
          <span className="concept" style={{ animationDelay: "900ms" }}>
            (i−1)/2
          </span>
          . No pointers. Just{" "}
          <span className="concept" style={{ animationDelay: "1350ms" }}>
            arithmetic
          </span>
          .
        </p>
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

function TeachRulePart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null

  return (
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>The one rule</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">The heap rule</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <HeapDualView
          heap={q.heap}
          highlightSlots={[0, 1, 2]}
          connectorSlot={0}
          reducedMotion={reduced}
          srLabel={`The root ${q.heap[0]} beats both children ${q.heap[1]} and ${q.heap[2]}, but the two children are not ordered against each other.`}
        />
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Each parent <span className="concept">beats both</span> its children, and that's the only
          promise. Two siblings can sit in{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            any order
          </span>
          : a heap is{" "}
          <span className="concept" style={{ animationDelay: "900ms" }}>
            not sorted
          </span>
          , and{" "}
          <span className="concept" style={{ animationDelay: "1350ms" }}>
            not a BST
          </span>
          .
        </p>
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </StageCenter>
  )
}

function TeachExtractPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const skin = erMonitorSkin(useOptionalTheme())
  if (!q) return null
  const op = motionOpOf(q)

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-7"
      style={{ background: skin.bg, color: skin.ink }}
    >
      <StageCenter>
        <MonitorMasthead reduced={reduced} surface="auto" />
        <MonitorBanner label="Discharging" sublabel="top of board" heap={q.heap} />
        <div className="mt-3 text-center animate-fade-in">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: skin.red }}
          >
            Extract the top
          </p>
          <h2 className="mt-1 text-lg font-bold" style={{ color: skin.ink }}>
            Discharging the top patient
          </h2>
          {/* Hardcoded teaching prose (mirrors the engine prompt) so the two process
              terms can glow in reading order; the StepReplay below shows it happen. */}
          <p className="mx-auto mt-1.5 max-w-xs text-sm" style={{ color: skin.sub }}>
            The most urgent patient leaves. The last one on the board{" "}
            <span className="concept">jumps to the top</span>, then{" "}
            <span className="concept" style={{ animationDelay: "450ms" }}>
              sinks past anyone more urgent
            </span>
            .
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
          {op && (
            <StepReplay op={op} reduced={reduced} renderFigure={triageFigure} surface="clinical" />
          )}
          {q.cost && q.sortCost && (
            <div className="flex flex-wrap justify-center gap-2">
              <ClinicalCost label="See who's next" cost={q.cost} />
              <ClinicalCost label="Sort the whole board" cost={q.sortCost} />
            </div>
          )}
        </div>

        <div className="mt-auto">
          <MonitorButton onClick={() => dispatch({ type: "continue" })}>Continue</MonitorButton>
        </div>
      </StageCenter>
    </motion.div>
  )
}
