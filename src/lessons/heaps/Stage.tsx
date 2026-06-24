import { useState, type Dispatch } from "react"
import { Ambulance, ArrowLeft, ArrowRight, Check, RotateCcw, X } from "lucide-react"
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
import { HeapDualView, type HeapFigureRenderer, type SlotTone } from "./HeapDualView"
import { ERTriageBoard } from "./ERTriageBoard"

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

/** Subtle clinical (teal) full-bleed wash for the ER skin; fades to the page bg.
 * Teal, not the danger token, so the screen never reads as a FAIL state. */
const ER_TINT = "linear-gradient(180deg, rgba(13,148,136,0.12), transparent 240px)"

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
}: {
  spec: ReplaySpec
  intro?: IntroFrame
  reduced: boolean
  renderFigure?: HeapFigureRenderer
}) {
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
      <p className="max-w-xs text-center text-xs text-muted-foreground">{caption}</p>
      {lastIdx > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="default"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
            Step {idx} / {lastIdx}
          </span>
          <Button
            variant="secondary"
            size="default"
            disabled={idx === lastIdx}
            onClick={() => setIdx((i) => Math.min(lastIdx, i + 1))}
          >
            Next <ArrowRight className="size-4" />
          </Button>
          <Button variant="soft" size="default" onClick={() => setIdx(0)}>
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

function ArrangementChips({ heap }: { heap: number[] }) {
  return (
    <div className="flex items-end gap-1">
      {heap.map((v, i) => (
        <div key={`${i}-${v}`} className="flex flex-col items-center">
          <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-xs font-bold text-foreground">
            {v}
          </span>
          <span className="mt-0.5 text-[8px] leading-none text-faint">{i}</span>
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
 */
function ArrangementCard({
  letter,
  heap,
  state,
  disabled,
  answerMarker,
  onSelect,
}: {
  letter: string
  heap: number[]
  state: AnswerState
  disabled?: boolean
  answerMarker?: boolean
  onSelect?: () => void
}) {
  const reduced = useReducedMotion() ?? false
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
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "cursor-default",
        CARD_SURFACE[state],
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          CARD_BADGE[state],
        )}
      >
        {letter}
      </span>
      <ArrangementChips heap={heap} />
      {state === "correct" && (
        <span className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-danger text-white">
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
  renderFigure = defaultFigure,
  skin = false,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
  /** The synced figure (defaults to HeapDualView; the ER skin passes the board). */
  renderFigure?: HeapFigureRenderer
  /** ER-skin flavour: swaps the abstract de-cue for the patient-admission cue. */
  skin?: boolean
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
    <>
      <BinHeader state={state} />

      <div className="flex flex-col items-center gap-3 py-4">
        {reveal ? (
          <StepReplay
            spec={replay.spec}
            intro={replay.intro}
            reduced={reduced}
            renderFigure={renderFigure}
          />
        ) : (
          <>
            {renderFigure({ heap: q.heap, reducedMotion: reduced, srLabel: givenSentence(q) })}
            {skin ? <TriageCue q={q} /> : <DeCue q={q} />}
          </>
        )}
      </div>

      {correct && q.cost && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <LabeledCost label="Sift" cost={q.cost} />
          {q.sortCost && <LabeledCost label="Full sort" cost={q.sortCost} />}
        </div>
      )}

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
  )
}

function ArrangementPart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  return (
    <div className="flex flex-1 flex-col">
      <ArrangementBody state={state} dispatch={dispatch} />
    </div>
  )
}

/** The shared ER triage header (the skin's chrome). Teal reads "hospital", and
 * keeps the danger token free for the FAIL state. No em dashes in learner copy. */
function TriageHeader() {
  return (
    <div className="mt-1 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-soft">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: "#0d9488" }}
      >
        <Ambulance className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-foreground">ER Triage Board</p>
        <p className="text-[11px] leading-tight text-muted-foreground">
          The most urgent patient is always seen first.
        </p>
      </div>
    </div>
  )
}

/** The ER admission cue (the skin's swap for the abstract "Insert K" de-cue). */
function TriageCue({ q }: { q: HeapsQuestion }) {
  if (q.insertKey == null) return null
  return (
    <span className="rounded-full bg-lilac-soft px-3 py-1 text-sm font-semibold text-lilac-strong">
      New patient · severity {q.insertKey}
    </span>
  )
}

/**
 * Beat 5. The ER triage real-life skin of the sift-up beat. A full-bleed clinical
 * wrapper (the PlaylistQueue pattern) hosts the same predict-the-arrangement
 * mechanic, but the figure is the ERTriageBoard: a new patient is admitted and
 * climbs to their rank, the most urgent always on top. Determinism is untouched,
 * the cards still carry the dev `answer-card` / `data-answer` hooks, and the skin
 * never computes correctness (severities are the distinct keys).
 */
function TriagePart({
  state,
  dispatch,
}: {
  state: HeapsState
  dispatch: Dispatch<LessonAction>
}) {
  const reduced = useReducedMotion() ?? false
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-6"
      style={{ background: ER_TINT }}
    >
      <TriageHeader />
      <ArrangementBody state={state} dispatch={dispatch} renderFigure={triageFigure} skin />
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
    <div className="flex flex-1 flex-col">
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
    </div>
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
    <div className="flex flex-1 flex-col">
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
    </div>
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
    <div className="flex flex-1 flex-col">
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
    </div>
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
    <div className="flex flex-1 flex-col">
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
    </div>
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
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-6"
      style={{ background: ER_TINT }}
    >
      <TriageHeader />
      <div className="mt-5 text-center">
        <h2 className="text-xl font-bold text-foreground">Discharging the top patient</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <StepReplay spec={spec} intro={intro} reduced={reduced} renderFigure={triageFigure} />
        {q.cost && q.sortCost && (
          <div className="flex flex-wrap justify-center gap-2">
            <LabeledCost label="See who's next" cost={q.cost} />
            <LabeledCost label="Sort the whole board" cost={q.sortCost} />
          </div>
        )}
      </div>

      <div className="mt-auto">
        <ContinueButton dispatch={dispatch} />
      </div>
    </motion.div>
  )
}
