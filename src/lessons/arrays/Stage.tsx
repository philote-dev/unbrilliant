import { useEffect, useRef, useState, type Dispatch, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction } from "@/features/lesson/engine"
import {
  currentPartArrays,
  gapTargetsArrays,
  isTerminalA,
  partQuotaArrays,
  shiftFrames,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { ArrayStrip, type Overlay } from "./ArrayStrip"
import { CELL, RULER_GAP, RULER_H } from "./arrayStripLayout"
import { applyDelete, applyInsert, freeLabel, type PlayCell } from "./playMutate"
import { CapacityFrame } from "./CapacityFrame"
import { SpreadsheetInsert } from "./SpreadsheetInsert"

/**
 * The rebuilt Arrays stage: a switch over the 9 beats. Every graded beat is
 * "predict, then act, then see the consequence": the access beats fire the
 * jump/scan you triggered, the count beats replay the ripple you predicted, the
 * place beat lets you choose the gap (where it lands is the cost), and the grow
 * beat bursts the full block. The two play beats are live, not slideshows. All
 * verdict UX flows through the shared FeedbackFooter with the SR-only fail copy.
 */
export function ArraysStage({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  switch (currentPartArrays(state)) {
    case "play-access":
      return <PlayAccessPart dispatch={dispatch} />
    case "jump":
      return <AccessPart state={state} dispatch={dispatch} />
    case "scan":
      return <ScanPart state={state} dispatch={dispatch} />
    case "play-mutate":
      return <PlayMutatePart dispatch={dispatch} />
    case "insert":
    case "delete":
    case "realworld":
      return <CountPart state={state} dispatch={dispatch} />
    case "place-cheapest":
      return <PlaceCheapestPart state={state} dispatch={dispatch} />
    case "grow":
      return <GrowPart state={state} dispatch={dispatch} />
  }
}

/* ----------------------------- shared bits ----------------------------- */

/** The intro-pages eyebrow: a small, wide-tracked lilac kicker. */
function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong",
        className,
      )}
    >
      {children}
    </p>
  )
}

/**
 * An inline highlighted word that also drives a live demo: hovering, focusing, or
 * tapping it turns `active` on (and tap latches it), so "index" can light up the
 * ruler beneath the strip. Reads as the same lilac `.concept` term, with a dotted
 * underline to signal it is interactive.
 */
function ConceptTrigger({
  active,
  onChange,
  children,
}: {
  active: boolean
  onChange: (on: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        "concept rounded underline decoration-dotted decoration-from-font underline-offset-4 outline-none",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60",
        active && "bg-lilac-soft",
      )}
      style={{ animationDelay: "200ms" }}
      aria-pressed={active}
      onPointerEnter={() => onChange(true)}
      onPointerLeave={() => onChange(false)}
      onFocus={() => onChange(true)}
      onBlur={() => onChange(false)}
      onClick={() => onChange(!active)}
    >
      {children}
    </button>
  )
}

function Header({ kicker, prompt }: { kicker: string; prompt: string }) {
  return (
    <div className="mt-7">
      <Eyebrow>{kicker}</Eyebrow>
      <h2 className="mx-auto mt-2 max-w-sm text-balance text-center text-xl font-bold text-foreground lg:text-2xl">
        {prompt}
      </h2>
    </div>
  )
}

function Quota({ state }: { state: ArraysState }) {
  const quota = partQuotaArrays(state)
  if (!quota) return null
  return (
    <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
      {quota.done} / {quota.total}
    </p>
  )
}

function mcqCardState(
  id: string,
  answer: string | undefined,
  selected: string | null,
  feedback: ArraysState["feedback"],
  showWhy: boolean,
): AnswerState {
  if (feedback === "correct") return id === answer ? "correct" : "default"
  if (feedback === "nudge") return id === selected ? "nudge" : "default"
  if (feedback === "fail") {
    if (showWhy && id === answer) return "correct"
    if (id === selected) return "fail"
    return "default"
  }
  return id === selected ? "selected" : "default"
}

const copyOf = (q: NonNullable<ArraysState["question"]>) => ({
  prompt: q.prompt,
  hint: q.hint,
  nudge: q.nudge,
  correct: q.correct,
  why: q.why,
})

/* ------------------------------ play: access ----------------------------- */

const PLAY_CELLS = ["A", "B", "C", "D", "E", "F"]

function PlayAccessPart({ dispatch }: { dispatch: Dispatch<LessonAction> }) {
  const [touched, setTouched] = useState(-1)
  const [indexLit, setIndexLit] = useState(false)

  return (
    <StageCenter maxWidthClass="max-w-xl">
      <div className="mt-8 text-center animate-fade-in">
        <Eyebrow>Arrays</Eyebrow>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
          One unbroken row
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-9 py-6">
        <ArrayStrip
          mode="read"
          cells={PLAY_CELLS}
          highlight={touched}
          tone="active"
          overlay={touched >= 0 ? ({ kind: "jump", k: touched } as Overlay) : null}
          onTap={setTouched}
          rulerLit={indexLit}
          scale={1.35}
        />
        <p
          key={touched}
          className="mx-auto max-w-md text-pretty text-center text-xl leading-relaxed text-foreground/90 lg:text-2xl"
        >
          {touched >= 0 ? (
            <>
              Position <span className="concept">{touched}</span> holds{" "}
              <span className="concept">{PLAY_CELLS[touched]}</span>. You jump straight there, no searching.
            </>
          ) : (
            <>
              Tap any cell. The number under it is its{" "}
              <ConceptTrigger active={indexLit} onChange={setIndexLit}>
                index
              </ConceptTrigger>
              , and you{" "}
              <span className="concept" style={{ animationDelay: "650ms" }}>
                jump
              </span>{" "}
              straight to any position.
            </>
          )}
        </p>
      </div>

      <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
        Continue
      </Button>
    </StageCenter>
  )
}

/* ------------------------------ jump (de-cued access) ------------------------------ */

function AccessPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalA(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const selIdx = selected != null ? Number(selected) : -1
  const ansIdx = q.answerIndex ?? -1
  const highlight = reveal ? ansIdx : selIdx
  const tone = reveal ? "correct" : feedback === "nudge" || feedback === "fail" ? "wrong" : "active"
  const overlay: Overlay = reveal ? { kind: "jump", k: ansIdx } : null

  return (
    <StageCenter>
      <Header kicker="Jump by index" prompt={q.prompt} />
      <Quota state={state} />

      {/* extra top room so the jump halo (which floats well above the row) never
          rides up into the prompt */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-5 pt-24">
        <ArrayStrip
          mode="read"
          cells={q.cells}
          highlight={highlight}
          tone={tone}
          overlay={overlay}
          answerIndex={ansIdx}
          onTap={terminal ? undefined : (i) => dispatch({ type: "select", letter: String(i) })}
        />
        {reveal && <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />}
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Find the <span className="concept">index</span>, then tap that cell.
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={copyOf(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/* ------------------------------ scan (walk the row) ------------------------------ */

/**
 * The cells the learner may tap next. Before the search starts (nothing revealed)
 * any cell can begin it; afterwards only the two cells immediately outside the
 * revealed run [min, max] are reachable, so the value search has to walk.
 */
function scanFrontier(revealed: Set<number>, n: number): Set<number> {
  if (revealed.size === 0) return new Set(Array.from({ length: n }, (_, i) => i))
  const min = Math.min(...revealed)
  const max = Math.max(...revealed)
  const frontier = new Set<number>()
  if (min - 1 >= 0) frontier.add(min - 1)
  if (max + 1 < n) frontier.add(max + 1)
  return frontier
}

/**
 * The value search as a hands-on walk: the strip starts blank-faced, the learner
 * taps to reveal one cell at a time, and only the frontier is tappable so there
 * is no shortcut. The walk (revealed set + anchor) is local React state; the
 * moment the learner reveals the cell holding `q.value` we dispatch the existing
 * select+check so the engine grades it exactly as before (committed index ===
 * answerIndex). Finding the value is inevitable, and that is the point: the cost
 * readout reports how many cells the learner actually had to check.
 */
function ScanPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const [anchor, setAnchor] = useState<number | null>(null)
  const q = state.question
  if (!q) return null

  const { feedback, selected, showWhy } = state
  const terminal = isTerminalA(state)
  const solved = feedback === "correct"
  const n = q.cells.length
  const ansIdx = q.answerIndex ?? -1
  const checked = revealed.size
  const tappable = terminal ? new Set<number>() : scanFrontier(revealed, n)

  const onTap = (i: number) => {
    if (terminal || !tappable.has(i)) return
    setRevealed((prev) => new Set(prev).add(i))
    if (anchor == null) setAnchor(i)
    if (i === ansIdx) {
      dispatch({ type: "select", letter: String(ansIdx) })
      dispatch({ type: "check" })
    }
  }

  return (
    <StageCenter>
      <Header kicker="Search by value" prompt={q.prompt} />
      <Quota state={state} />

      {/* top room for the anchor marker, which floats above the row */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-5 pt-20">
        <ArrayStrip
          mode="scan"
          cells={q.cells}
          revealed={revealed}
          tappable={tappable}
          anchorIndex={anchor}
          matchIndex={ansIdx}
          onTap={onTap}
        />
        {solved ? (
          <CostReadout
            word={q.cost.word}
            count={checked}
            unit={checked === 1 ? "cell checked" : "cells checked"}
          />
        ) : (
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            {anchor == null ? (
              <>
                No index to jump to: tap any cell, then <span className="concept">scan</span>{" "}
                one at a time until the value turns up.
              </>
            ) : (
              <>
                Keep walking the row. {checked} cell{checked === 1 ? "" : "s"} checked so far.
              </>
            )}
          </p>
        )}
      </div>

      {terminal ? (
        <FeedbackFooter
          feedback={feedback}
          selected={selected}
          showWhy={showWhy}
          hideFailHint
          copy={copyOf(q)}
          dispatch={dispatch}
        />
      ) : (
        <div className="mt-auto min-h-[132px]" aria-hidden />
      )}
    </StageCenter>
  )
}

/* ------------------------------ play: mutation ----------------------------- */

// A pool of distinct labels (each cell also gets a stable numeric id), so a cell
// can be deleted and a later insert reuses the freed label without key clashes.
// Sized so the widest row (every label in use) still fits a phone at CELL width.
const MUTATE_POOL = ["A", "B", "C", "D", "E", "F", "G"]
const MUTATE_START = ["A", "B", "C", "D"]
const MUTATE_SPRING = { type: "spring", stiffness: 420, damping: 32 } as const

function PlayMutatePart({ dispatch }: { dispatch: Dispatch<LessonAction> }) {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced ?? false

  const [cells, setCells] = useState<PlayCell[]>(() =>
    MUTATE_START.map((label, id) => ({ id, label })),
  )
  const [k, setK] = useState(2)
  const [litIds, setLitIds] = useState<Set<number>>(() => new Set())
  const nextId = useRef(MUTATE_START.length)

  const full = cells.length >= MUTATE_POOL.length
  const at = Math.min(k, cells.length)

  // The cells that just slid glow briefly so the shift reads as directional; the
  // glow fades on its own. Reduced motion never lights up, so it leaves no timer.
  useEffect(() => {
    if (litIds.size === 0) return
    const timer = setTimeout(() => setLitIds(new Set()), 700)
    return () => clearTimeout(timer)
  }, [litIds])

  const insert = () => {
    if (full) return
    const label = freeLabel(cells, MUTATE_POOL)
    if (!label) return
    const cell: PlayCell = { id: nextId.current++, label }
    const next = applyInsert(cells, at, cell)
    setCells(next.cells)
    if (!reduced) setLitIds(new Set([...next.movingIds, cell.id]))
  }
  const remove = (i: number) => {
    const next = applyDelete(cells, i)
    setCells(next.cells)
    if (!reduced) setLitIds(next.movingIds)
  }

  return (
    <StageCenter maxWidthClass="max-w-xl">
      <div className="mt-8 text-center animate-fade-in">
        <Eyebrow>Insert & delete</Eyebrow>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
          Make room, close gaps
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <MutateSlotRow
          cells={cells}
          caretAt={full ? null : at}
          litIds={litIds}
          onDelete={remove}
          reduced={reduced}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Insert at index</span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              className="size-9 p-0"
              onClick={() => setK((v) => Math.max(0, v - 1))}
              disabled={at <= 0}
              aria-label="Lower the insert index"
            >
              -
            </Button>
            <span className="w-6 text-center text-sm font-bold tabular-nums">{at}</span>
            <Button
              variant="secondary"
              className="size-9 p-0"
              onClick={() => setK((v) => Math.min(cells.length, v + 1))}
              disabled={at >= cells.length}
              aria-label="Raise the insert index"
            >
              +
            </Button>
          </div>
          <Button variant="soft" onClick={insert} disabled={full}>
            Insert
          </Button>
        </div>
        <p className="mx-auto max-w-md text-pretty text-center text-xl leading-relaxed text-foreground/90 lg:text-2xl">
          A middle change makes every cell after it{" "}
          <span className="concept" style={{ animationDelay: "200ms" }}>
            slide over
          </span>
          . The <span className="concept" style={{ animationDelay: "650ms" }}>end</span> shifts nothing.
        </p>
      </div>

      <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
        Continue
      </Button>
    </StageCenter>
  )
}

/**
 * The free-play row, drawn by ABSOLUTE SLOT so the shift is directional and
 * left-anchored: every cell is a tap-to-delete button placed at x = slot * CELL,
 * springing to its new slot. Cells before the change keep their x (no motion);
 * only the tail slides, then the inserted cell fades into the opened gap. The
 * address ruler stays fixed beneath, so a shifted cell visibly lands on a new
 * index. Reduced motion snaps to the final arrangement with no slide.
 */
function MutateSlotRow({
  cells,
  caretAt,
  litIds,
  onDelete,
  reduced,
}: {
  cells: PlayCell[]
  /** The index the next Insert opens its gap at, or null when the row is full. */
  caretAt: number | null
  /** Ids of the cells to glow as "just shifted" (plus the freshly inserted one). */
  litIds: Set<number>
  onDelete: (index: number) => void
  reduced: boolean
}) {
  const n = cells.length

  return (
    <div
      className="relative self-start"
      style={{ width: n * CELL, height: CELL + RULER_GAP + RULER_H }}
    >
      {/* the fixed address ruler: indices hold still while cells slide between
          them, so a shifted cell is seen to take a new index. */}
      <div
        className="absolute inset-x-0 flex"
        style={{ top: CELL + RULER_GAP, height: RULER_H }}
        aria-hidden
      >
        {Array.from({ length: n }).map((_, i) => (
          <span
            key={i}
            className="flex items-center justify-center text-xs tabular-nums text-faint"
            style={{ width: CELL }}
          >
            {i}
          </span>
        ))}
      </div>

      {/* the caret marks the seam where the next Insert opens its gap. */}
      {caretAt != null && (
        <motion.div
          className="absolute top-0 z-10 w-[3px] rounded-full bg-lilac-strong"
          style={{ height: CELL }}
          initial={false}
          animate={{ x: caretAt * CELL - 1.5 }}
          transition={reduced ? { duration: 0 } : MUTATE_SPRING}
          aria-hidden
        />
      )}

      {/* the value cells: each at x = slot * CELL, springing to its new slot. */}
      <AnimatePresence initial={false}>
        {cells.map((c, i) => (
          <motion.button
            key={c.id}
            type="button"
            data-testid="play-cell"
            onClick={() => onDelete(i)}
            aria-label={`Delete value ${c.label} at index ${i}`}
            className={cn(
              "absolute left-0 top-0 box-border flex items-center justify-center rounded-xl border-2 text-lg font-bold text-foreground outline-none transition-colors",
              "cursor-pointer hover:border-lilac-strong hover:bg-lilac-soft focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-lilac-strong/60",
              litIds.has(c.id) ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
            )}
            style={{ width: CELL, height: CELL }}
            initial={reduced ? false : { opacity: 0, scale: 0.6, x: i * CELL }}
            animate={{ opacity: 1, scale: 1, x: i * CELL }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.5 }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    x: MUTATE_SPRING,
                    opacity: { duration: 0.2, delay: 0.18 },
                    scale: { ...MUTATE_SPRING, delay: 0.18 },
                  }
            }
          >
            {c.label}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* --------------------------- insert / delete / realworld (predict the count) --------------------------- */

// One slot-move per frame; tuned so the staggered springs read as a single wave.
const WAVE_FRAME_MS = 130

function CountPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced ?? false
  const q = state.question
  const { feedback, selected, showWhy } = state
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const part = currentPartArrays(state)
  const isRealworld = part === "realworld"
  // The realworld skin animates via SpreadsheetInsert; only insert/delete play the
  // ArrayStrip ripple, so only they need the wave timer.
  const usesRipple = part === "insert" || part === "delete"

  // shiftFrames is a staggered sequence: each frame moves exactly one cell and the
  // final frame is the end-state. On reveal we PLAY the frames over time, so the
  // cells visibly slide slot by slot (RippleStrip springs each one-slot move into
  // the new slot). Reduced motion shows the final frame straight away, no timer.
  const frames = usesRipple && q?.op ? shiftFrames(q.cells, q.op) : []
  const frameCount = frames.length
  const last = Math.max(0, frameCount - 1)
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    // Reduced motion derives the final frame directly (below), so it never mounts
    // the intermediate calm frame; only the live wave steps the index over time.
    if (reduced || !reveal || last <= 0) {
      setFrameIndex(0)
      return
    }
    setFrameIndex(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setFrameIndex(i)
      if (i >= last) window.clearInterval(id)
    }, WAVE_FRAME_MS)
    return () => window.clearInterval(id)
  }, [reveal, last, reduced])

  if (!q || !q.options) return null
  const terminal = isTerminalA(state)

  // Reduced motion jumps to the end-state on the first paint (no exit animation to
  // strand); the live wave walks the played index. Guard the index either way.
  const shownIndex = reduced ? last : Math.min(frameIndex, last)
  const currentFrame = frameCount > 0 ? frames[shownIndex] : undefined
  // Announce the end-state once: the SR hears the final caption as a single
  // coherent sentence rather than every step coalesced into a last-only blur.
  const finalCaption = frameCount > 0 ? frames[last].caption : undefined
  const kicker = isRealworld ? "Real-world · row shift" : part === "insert" ? "Insert" : "Delete"

  return (
    <StageSplit
      header={
        <>
          <Header kicker={kicker} prompt={q.prompt} />
          <Quota state={state} />
        </>
      }
      figure={
        <div className="flex flex-col items-center gap-3 py-4">
          {isRealworld && q.op ? (
            <SpreadsheetInsert cells={q.cells} op={q.op} reveal={reveal} />
          ) : reveal && currentFrame ? (
            <ArrayStrip
              mode="ripple"
              frame={currentFrame}
              caption={finalCaption}
              opIndex={q.op?.index ?? -1}
            />
          ) : (
            <ArrayStrip mode="read" cells={q.cells} highlight={q.op?.index ?? -1} tone="active" />
          )}
          {reveal && <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />}
        </div>
      }
      interaction={
        <>
          <div className="flex flex-col gap-2.5">
            {q.options.map((opt, i) => (
              <AnswerCard
                key={opt.id}
                letter={String.fromCharCode(65 + i)}
                label={opt.label}
                state={mcqCardState(opt.id, q.answer, selected, feedback, showWhy)}
                disabled={terminal}
                answerMarker={opt.id === q.answer}
                onSelect={() => dispatch({ type: "select", letter: opt.id })}
              />
            ))}
          </div>

          <FeedbackFooter
            feedback={feedback}
            selected={selected}
            showWhy={showWhy}
            hideFailHint
            copy={copyOf(q)}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}

/* ------------------------------ place-cheapest (gap drag) ------------------------------ */

function PlaceCheapestPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || !q.classify) return null
  const { feedback, selected, showWhy } = state
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const { n, midK } = q.classify

  return (
    <StageCenter>
      <Header kicker="Place it cheapest" prompt={q.prompt} />
      <Quota state={state} />

      <div className="flex flex-1 flex-col justify-center py-3">
        <RewireSurface
          legalTargets={gapTargetsArrays(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label="Drop the cell into the gap where it costs the least"
          className="flex flex-col items-center"
        >
          <ArrayStrip mode="place" cells={q.cells} selectedGap={selected} correctGap={q.answer} looseLabel="X" />
        </RewireSurface>

        {reveal && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <LabeledCost label="Front" count={n} />
            <LabeledCost label="Middle" count={n - midK} />
            <LabeledCost label="End" count={0} />
          </div>
        )}
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={copyOf(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

function LabeledCost({ label, count }: { label: string; count: number }) {
  const word = count === 0 ? "free" : "scales"
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <CostReadout word={word} count={count} unit={count === 1 ? "cell moved" : "cells moved"} />
    </div>
  )
}

/* -------------------------------- grow -------------------------------- */

function GrowPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || !q.options) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalA(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  return (
    <StageSplit
      header={
        <>
          <Header kicker="Grow · dynamic array" prompt={q.prompt} />
          <Quota state={state} />
        </>
      }
      figure={
        <div className="flex flex-col items-center gap-3 py-4">
          {q.resize && <CapacityFrame resize={q.resize} cells={q.cells} reveal={reveal} />}
          {reveal && <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />}
        </div>
      }
      interaction={
        <>
          <div className="flex flex-col gap-2.5">
            {q.options.map((opt, i) => (
              <AnswerCard
                key={opt.id}
                letter={String.fromCharCode(65 + i)}
                label={opt.label}
                state={mcqCardState(opt.id, q.answer, selected, feedback, showWhy)}
                disabled={terminal}
                answerMarker={opt.id === q.answer}
                onSelect={() => dispatch({ type: "select", letter: opt.id })}
              />
            ))}
          </div>

          <FeedbackFooter
            feedback={feedback}
            selected={selected}
            showWhy={showWhy}
            hideFailHint
            copy={copyOf(q)}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}
