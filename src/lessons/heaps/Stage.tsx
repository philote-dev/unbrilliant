import { useState, type Dispatch, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check, Info, RotateCcw, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import type { LessonAction } from "@/features/lesson/engine"
import {
  applySwaps,
  binQuotaHeaps,
  currentPartHeaps,
  extractIntroFrame,
  isTerminalHeaps,
  leftIndex,
  partQuotaHeaps,
  rightIndex,
  siftUp,
  slotId,
  slotIndexOf,
  type HeapBin,
  type HeapCost,
  type HeapsQuestion,
  type HeapsState,
  type SwapStep,
} from "@/features/lesson/heapsEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { HeapDualView, type HeapFigureRenderer, type SlotTone } from "./HeapDualView"
import { ERTriageBoard, PATIENT_ICON } from "./ERTriageBoard"
import { patientFor } from "./triagePatients"
import { AmbulanceMark, EcgLine } from "./MonitorChrome"

const LETTERS = ["A", "B", "C", "D"]
const BIN_LABEL: Record<HeapBin, string> = {
  siftUp: "Sift up",
  siftDown: "Sift down",
  mapping: "Mapping",
  contrast: "Contrast",
}

/** The two synced figures the replay/idle views can render through `renderFigure`. */
const defaultFigure: HeapFigureRenderer = (props) => <HeapDualView {...props} />
const triageFigure: HeapFigureRenderer = (props) => <ERTriageBoard {...props} />

/** Clinical dark monitor surface for the ER triage skin. Always dark (like the
 * Spotify queue), so the page transforms into a hospital triage wall display. The
 * top glow leans lavender/light-blue to match the medical refs. */
const MONITOR_BG =
  "radial-gradient(120% 70% at 50% -10%, rgba(160,178,240,0.16), transparent 60%), linear-gradient(180deg, #0b1220 0%, #0e1626 60%, #0b1220 100%)"

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
    case "teach-extract":
      return <TeachExtractPart state={state} dispatch={dispatch} />
    case "map-child":
    case "map-parent":
    case "contrast-samedata":
      return <SlotLocatePart state={state} dispatch={dispatch} />
    case "siftup-skin":
      return <TriagePart state={state} dispatch={dispatch} />
    default:
      return <ArrangementPart state={state} dispatch={dispatch} />
  }
}

/* -------------------------------- shared bits ------------------------------- */

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
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
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

/**
 * The minimal data a synced replay needs, decoupled from the full question so the
 * same stepper drives a graded reveal, the teach-extract beat, AND the free-play
 * demo (each insert).
 */
interface ReplaySpec {
  startHeap: number[]
  path: SwapStep[]
  resultHeap: number[]
  insertKey?: number | null
  extracted?: number | null
}

/** An optional "before" frame shown ahead of the sift (the extract setup). */
interface IntroFrame {
  heap: number[]
  highlightSlots: number[]
  caption: string
}

function siftSentence(spec: ReplaySpec): string {
  if (!spec.path.length) {
    const landing = spec.resultHeap.join(", ")
    return spec.insertKey != null
      ? `Insert ${spec.insertKey}: it lands with no swap. Final arrangement ${landing}.`
      : `Final arrangement ${landing}.`
  }
  const moves = spec.path.map((p) => `slots ${p.a} and ${p.b} swap`).join(", then ")
  return `${spec.path.length} swap${spec.path.length === 1 ? "" : "s"}: ${moves}. Final arrangement ${spec.resultHeap.join(
    ", ",
  )}.`
}

/** Build the replay spec (and, for extract beats, the prepended intro) from a question. */
function replayOf(q: HeapsQuestion): { spec: ReplaySpec; intro?: IntroFrame } {
  const spec: ReplaySpec = {
    startHeap: q.startHeap,
    path: q.path,
    resultHeap: q.resultHeap,
    insertKey: q.insertKey,
    extracted: q.extracted,
  }
  if (q.extracted == null) return { spec }
  const frame = extractIntroFrame(q.heap)
  const caption = `Take the top out (${q.heap[frame.leavingSlot]}). To keep the array packed with no gaps, the last item (${q.heap[frame.fillerSlot]}) moves up to fill the root, then it sinks.`
  return {
    spec,
    intro: { heap: frame.heap, highlightSlots: [frame.leavingSlot, frame.fillerSlot], caption },
  }
}

/**
 * The synced why-replay: a local Back/Next/Replay stepper over the engine's
 * precomputed `path`, driving a dual tree+array figure so both panels move
 * together. For extract beats an `intro` frame is PREPENDED (the top leaving + the
 * last item rising to fill it) before the sift-down begins. The step index is
 * transient UI state and never touches the verdict. No timers (manual stepper).
 * Reduced motion snaps to the end-state (no lift) but still lets the learner walk.
 * `renderFigure` lets a skin (the ER triage board) swap the figure while keeping
 * the identical step math and sync contract; it defaults to the HeapDualView.
 */
function StepReplay({
  spec,
  intro,
  reduced,
  renderFigure = defaultFigure,
  surface = "default",
}: {
  spec: ReplaySpec
  intro?: IntroFrame
  reduced: boolean
  renderFigure?: HeapFigureRenderer
  /** "clinical" themes the caption + Back/Next/Replay controls for the dark monitor. */
  surface?: "default" | "clinical"
}) {
  const clinical = surface === "clinical"
  const stepBtn = clinical
    ? "border-white/20 bg-white/[0.05] text-slate-100 hover:bg-white/10 focus-visible:ring-sky-200/70 focus-visible:ring-offset-[#0b1220]"
    : undefined
  const replayBtn = clinical
    ? "bg-sky-400/15 text-sky-100 hover:bg-sky-400/25 focus-visible:ring-sky-200/70 focus-visible:ring-offset-[#0b1220]"
    : undefined
  const swaps = spec.path.length
  const introCount = intro ? 1 : 0
  const lastIdx = introCount + swaps
  const [idx, setIdx] = useState(reduced ? lastIdx : 0)

  // `intro && idx === 0` (rather than a hoisted boolean) so TS narrows `intro`.
  const inIntro = intro != null && idx === 0
  const step = Math.max(0, idx - introCount) // swaps applied so far (0..swaps)
  const heap = intro && idx === 0 ? intro.heap : applySwaps(spec.startHeap, spec.path, step)
  const pair = !inIntro && step > 0 ? spec.path[step - 1] : null
  const startSlot = spec.insertKey != null ? spec.startHeap.length - 1 : 0
  const highlight =
    intro && idx === 0 ? intro.highlightSlots : pair ? [pair.a, pair.b] : [startSlot]

  const caption =
    intro && idx === 0
      ? intro.caption
      : step === 0
        ? spec.insertKey != null
          ? `${spec.insertKey} drops into the next open slot.`
          : `The last item (${spec.startHeap[0]}) moves to the top.`
        : `Swap slots ${pair!.a} and ${pair!.b}.`

  return (
    <div className="flex flex-col items-center gap-3">
      {renderFigure({
        heap,
        highlightSlots: highlight,
        liftPair: reduced || inIntro ? null : pair,
        reducedMotion: reduced,
        srLabel: intro && idx === 0 ? intro.caption : siftSentence(spec),
      })}
      <p
        className={cn(
          "max-w-xs text-center text-xs",
          clinical ? "text-slate-300" : "text-muted-foreground",
        )}
      >
        {caption}
      </p>
      {lastIdx > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="default"
            className={stepBtn}
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <span
            className={cn(
              "min-w-16 text-center text-xs tabular-nums",
              clinical ? "text-slate-400" : "text-muted-foreground",
            )}
          >
            Step {idx} / {lastIdx}
          </span>
          <Button
            variant="secondary"
            size="default"
            className={stepBtn}
            disabled={idx === lastIdx}
            onClick={() => setIdx((i) => Math.min(lastIdx, i + 1))}
          >
            Next <ArrowRight className="size-4" />
          </Button>
          <Button variant="soft" size="default" className={replayBtn} onClick={() => setIdx(0)}>
            <RotateCcw className="size-4" /> Replay
          </Button>
        </div>
      )}
    </div>
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
  const replay = replayOf(q)

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
          <div className="flex flex-col items-center gap-3 py-4">
            {reveal ? (
              <StepReplay spec={replay.spec} intro={replay.intro} reduced={reduced} />
            ) : (
              <>
                <HeapDualView heap={q.heap} reducedMotion={reduced} srLabel={givenSentence(q)} />
                <DeCue q={q} />
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

/* ----------------------------- ER triage skin ----------------------------- */

/** The triage monitor's top status bar (flat ambulance logo). Decorative chrome. */
function MonitorHeader() {
  return (
    <div aria-hidden className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <AmbulanceMark className="h-7 w-9 shrink-0" />
        <div className="leading-tight">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-100">
            Emergency Dept
          </p>
          <p className="text-[9px] uppercase tracking-[0.22em] text-slate-500">Triage monitor</p>
        </div>
      </div>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="size-2 animate-pulse rounded-full bg-red-500" /> Live
      </span>
    </div>
  )
}

/** The red ECG vital-signs ticker, in a full-bleed lane across the monitor. The
 * sweep animates when motion is on and is static under reduced motion. */
function VitalsLane({ reduced }: { reduced: boolean }) {
  return (
    <div
      aria-hidden
      className="-mx-5 mt-3 border-y border-white/10 bg-white/[0.02] px-3 py-1.5"
    >
      <EcgLine reducedMotion={reduced} />
    </div>
  )
}

/** The hero banner: the root patient (most urgent / being discharged). Decorative;
 * the figure's srLabel carries the same board state for non-sighted learners. */
function MonitorBanner({
  label,
  sublabel,
  heap,
}: {
  label: string
  sublabel: string
  heap: number[]
}) {
  const p = patientFor(heap[0], heap)
  const Glyph = PATIENT_ICON[p.icon]
  return (
    <div aria-hidden className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">{label}</span>
        <span className="mt-1 text-[9px] uppercase tracking-wide text-slate-500">{sublabel}</span>
      </div>
      <span
        className="flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-lg font-extrabold text-white"
        style={{ backgroundColor: p.accent }}
      >
        {p.severity}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-bold text-slate-100">{p.name}</p>
        <p className="text-[11px] text-slate-400">Priority {p.level}</p>
      </div>
      <Glyph className="size-5 shrink-0" style={{ color: p.accent }} />
    </div>
  )
}

/** The incoming-patient cue (decorative; the srLabel announces the admission). */
function TriageAdmitCue({ q }: { q: HeapsQuestion }) {
  if (q.insertKey == null) return null
  return (
    <span
      aria-hidden
      className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-200"
    >
      <AmbulanceMark className="h-4 w-5 shrink-0" />
      Incoming · severity {q.insertKey}
    </span>
  )
}

/** A cost readout with a clinical (slate) label for the dark monitor. */
function ClinicalCost({ label, cost }: { label: string; cost: HeapCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <CostReadout word={cost.word} count={cost.count} unit={cost.unit} />
    </div>
  )
}

function MonitorButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-sky-400 py-3.5 text-center text-[15px] font-bold text-slate-950 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] active:scale-[0.99] disabled:opacity-40"
    >
      {children}
    </button>
  )
}

const CHIP_TONE = {
  ok: { Icon: Check, ring: "bg-emerald-400/15 text-emerald-300" },
  bad: { Icon: X, ring: "bg-red-500/15 text-red-300" },
  hint: { Icon: Info, ring: "bg-amber-400/15 text-amber-300" },
} as const

/** Feedback chip: icon + text + a polite SR status (never colour alone). */
function MonitorChip({ tone, text }: { tone: keyof typeof CHIP_TONE; text: string }) {
  const { Icon, ring } = CHIP_TONE[tone]
  return (
    <div role="status" className="mb-4 flex flex-col items-center gap-2 text-center">
      <span className={cn("flex size-7 items-center justify-center rounded-full", ring)}>
        <Icon className="size-4" strokeWidth={3} />
      </span>
      <p className="text-sm text-slate-300">{text}</p>
    </div>
  )
}

/**
 * The monitor footer: the shared verdict machine, dispatching the SAME actions as
 * FeedbackFooter (select stays on the cards), themed for the dark monitor. Fail
 * never leaks the answer before the learner taps Why.
 */
function TriageFooter({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question!
  const { feedback, selected, showWhy } = state
  const canCheck = selected != null
  return (
    <div className="mt-auto min-h-[132px] pt-2">
      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm text-slate-400">{q.hint}</p>
          <MonitorButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </MonitorButton>
        </>
      )}
      {feedback === "nudge" && (
        <>
          <MonitorChip tone="hint" text={q.nudge} />
          <MonitorButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </MonitorButton>
        </>
      )}
      {feedback === "correct" && (
        <>
          <MonitorChip tone="ok" text={q.correct} />
          <MonitorButton onClick={() => dispatch({ type: "next" })}>Continue</MonitorButton>
        </>
      )}
      {feedback === "fail" && (
        <>
          <MonitorChip
            tone="bad"
            text={showWhy ? q.why : "Not quite. Tap Why for the answer, or reattempt."}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
              className="flex-1 rounded-full bg-white/10 py-3.5 font-semibold text-slate-100 outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220] disabled:opacity-40"
            >
              Why?
            </button>
            <MonitorButton onClick={() => dispatch({ type: "reattempt" })}>Reattempt</MonitorButton>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Beat 5. The ER triage real-life skin of the sift-up beat, as a FULL-SCREEN
 * hospital triage monitor: the page transforms edge-to-edge into a dark clinical
 * wall display (the way the playlist beat becomes Spotify). A new patient is
 * admitted and climbs to their rank, the most urgent always on top. Same
 * predict-the-arrangement mechanic and the SAME dev `answer-card` / `data-answer`
 * hooks; the skin never computes correctness (severities are the distinct keys).
 */
function TriagePart({
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
  const replay = replayOf(q)
  const boardHeap = correct ? q.resultHeap : q.heap
  const idleSr = `Triage board, most urgent first: ${q.heap.join(
    ", ",
  )}. A patient with severity ${q.insertKey} is arriving. Predict where they land.`

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
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-7 text-slate-100"
      style={{ background: MONITOR_BG }}
    >
      <StageCenter>
        <MonitorHeader />
        <VitalsLane reduced={reduced} />
        <MonitorBanner label="Seen next" sublabel="most urgent" heap={boardHeap} />
        <p className="mt-3 text-center text-sm text-slate-300">{q.prompt}</p>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
          {reveal ? (
            <StepReplay
              spec={replay.spec}
              intro={replay.intro}
              reduced={reduced}
              renderFigure={triageFigure}
              surface="clinical"
            />
          ) : (
            <>
              <ERTriageBoard heap={q.heap} reducedMotion={reduced} srLabel={idleSr} />
              <TriageAdmitCue q={q} />
            </>
          )}
        </div>

        {correct && q.cost && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <ClinicalCost label="Place the patient" cost={q.cost} />
            {q.sortCost && <ClinicalCost label="Re-sort the board" cost={q.sortCost} />}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {q.options.map((o, i) => (
            <ArrangementCard
              key={o.id}
              clinical
              letter={LETTERS[i] ?? String(i + 1)}
              heap={o.heap}
              state={cardState(o.id)}
              disabled={terminal}
              answerMarker={o.id === q.answer}
              onSelect={() => dispatch({ type: "select", letter: o.id })}
            />
          ))}
        </div>

        <TriageFooter state={state} dispatch={dispatch} />
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

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <HeapDualView
          heap={q.heap}
          connectorSlot={q.subjectSlot}
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
          Tap the array slot. The matching tree node lights up.
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

const DEMO_KEYS = [8, 11]

function DemoPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  const [heap, setHeap] = useState<number[]>(q ? q.heap : [])
  const [step, setStep] = useState(0)
  const [spec, setSpec] = useState<ReplaySpec | null>(null)
  if (!q) return null
  const nextKey = DEMO_KEYS[step]

  const insert = () => {
    if (nextKey == null) return
    const { result, path, start } = siftUp(heap, nextKey)
    setSpec({ startHeap: start, path, resultHeap: result, insertKey: nextKey })
    setHeap(result)
    setStep((s) => s + 1)
  }

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Heaps: the best is always on top</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        {spec ? (
          // Each insert remounts (fresh `key`) so the stepper restarts at the drop-in.
          <StepReplay key={step} spec={spec} reduced={reduced} />
        ) : (
          <HeapDualView
            heap={heap}
            reducedMotion={reduced}
            srLabel={`The heap is ${heap.join(", ")}.`}
          />
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {nextKey != null && (
          <Button variant="soft" size="lg" className="w-full" onClick={insert}>
            Insert {nextKey}
          </Button>
        )}
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
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">It secretly lives in an array</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
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
          Tap any slot: its children are <span className="font-semibold text-foreground">2·i+1</span>{" "}
          and <span className="font-semibold text-foreground">2·i+2</span>; its parent is{" "}
          <span className="font-semibold text-foreground">(i−1)/2</span>. No pointers. Just
          arithmetic.
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
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">The heap rule</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
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
          Each parent beats <span className="font-semibold text-foreground">both</span> its
          children, and that's the only promise. Two siblings can sit in any order: a heap is{" "}
          <span className="font-semibold text-foreground">not</span> sorted, and{" "}
          <span className="font-semibold text-foreground">not</span> a BST.
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
  if (!q) return null
  const { spec, intro } = replayOf(q)

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-7 text-slate-100"
      style={{ background: MONITOR_BG }}
    >
      <StageCenter>
        <MonitorHeader />
        <VitalsLane reduced={reduced} />
        <MonitorBanner label="Discharging" sublabel="top of board" heap={q.heap} />
        <div className="mt-3 text-center">
          <h2 className="text-lg font-bold text-slate-50">Discharging the top patient</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-300">{q.prompt}</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
          <StepReplay
            spec={spec}
            intro={intro}
            reduced={reduced}
            renderFigure={triageFigure}
            surface="clinical"
          />
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
