import { useEffect, useRef, useState, type Dispatch, type ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { motion, useReducedMotion, type PanInfo } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StepTransport } from "@/components/willow/StepTransport"
import type { LessonAction } from "@/features/lesson/engine"
import {
  constructReady,
  currentPart,
  isTerminal,
  legalTargets,
  partQuota,
  targetEmitStep,
  type Cell,
  type ClassifyQuestion,
  type ConstructQuestion,
  type ContrastQuestion,
  type Discipline,
  type PredictQuestion,
  type SQState,
} from "@/features/lesson/stacksQueuesEngine"
import { StackBin } from "./StackBin"
import { QueueTube } from "./QueueTube"
import { ContrastReplay } from "./ContrastReplay"
import { ClassifyReplay } from "./ClassifyReplay"
import { BrowserShowpiece } from "./BrowserShowpiece"
import { DriveThruLane } from "./DriveThruLane"
import { PrinterShowpiece } from "./PrinterShowpiece"

/**
 * Which skin the queue real-world beat wears. "drivethru" is the primary,
 * locked skin; flip to "printer" to fall back to the print-queue showpiece. The
 * engine still tags the beat theme "drivethru"; this switch picks the component.
 */
const REALWORLD_QUEUE_SKIN: "drivethru" | "printer" = "drivethru"

/**
 * How long the resolved "correct" state (green + check) is held before the
 * leaving replay runs, so the verdict reads first and the pop never flickers on
 * top of it. Reduced motion never advances to the leaving phase (see PredictPart).
 */
const LEAVE_BEAT_MS = 700

export function StacksQueuesStage({
  state,
  dispatch,
}: {
  state: SQState
  dispatch: Dispatch<LessonAction>
}) {
  const part = currentPart(state)
  if (part === "stack-demo") return <DemoPart discipline="stack" dispatch={dispatch} />
  if (part === "queue-demo") return <DemoPart discipline="queue" dispatch={dispatch} />
  if (part === "stack-teach") return <TeachPart discipline="stack" dispatch={dispatch} />
  if (part === "queue-teach") return <TeachPart discipline="queue" dispatch={dispatch} />

  const q = state.question
  if (!q) return null
  if (q.kind === "construct") return <ConstructPart state={state} dispatch={dispatch} />
  if (q.kind === "classify" || q.kind === "contrast")
    return <ComparePart state={state} dispatch={dispatch} />
  return <PredictPart state={state} dispatch={dispatch} />
}

/** Pick the container that matches the discipline (the shape teaches the rule). */
function Container({
  discipline,
  ...props
}: { discipline: Discipline } & Parameters<typeof StackBin>[0]) {
  return discipline === "stack" ? <StackBin {...props} /> : <QueueTube {...props} />
}

/**
 * Reveal a structure one cell at a time, in arrival order, so the learner *sees*
 * it being built when a new problem loads (e.g. the printer fills request by
 * request). Returns how many cells should be visible so far. Honors
 * `prefers-reduced-motion` by showing the whole structure at once.
 */
function useBuildIn(arrival: string[]): number {
  const reduce = useReducedMotion()
  const key = arrival.join(",")
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (reduce) {
      setCount(arrival.length)
      return
    }
    setCount(0)
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setCount(i)
      if (i >= arrival.length) clearInterval(timer)
    }, 360)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce])
  return count
}

/**
 * A Container that builds itself in over arrival order. Cells stay un-tappable
 * until the build finishes (so a learner can't answer a half-built structure).
 */
function BuildingContainer({
  discipline,
  cells,
  arrival,
  selectable,
  cellState,
  onSelectCell,
  answerId,
}: {
  discipline: Discipline
  cells: Cell[]
  arrival: string[]
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
}) {
  const built = useBuildIn(arrival)
  const visible = new Set(arrival.slice(0, built))
  const shown = cells.filter((c) => visible.has(c.id))
  const ready = built >= arrival.length
  return (
    <Container
      discipline={discipline}
      cells={shown}
      selectable={selectable && ready}
      cellState={cellState}
      onSelectCell={onSelectCell}
      answerId={answerId}
    />
  )
}

function QuotaLine({ state }: { state: SQState }) {
  const quota = partQuota(state)
  if (!quota) return null
  return (
    <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
      {quota.done} / {quota.total} correct
    </p>
  )
}

/* --------------------------------- demo play -------------------------------- */

const PLAY_LETTERS = ["A", "B", "C", "D", "E", "F"]
const PLAY_MAX = 5

function DemoPart({
  discipline,
  dispatch,
}: {
  discipline: Discipline
  dispatch: Dispatch<LessonAction>
}) {
  const isStack = discipline === "stack"
  const [play, setPlay] = useState<{ cells: Cell[]; n: number }>({ cells: [], n: 0 })

  const add = () =>
    setPlay((s) => {
      if (s.cells.length >= PLAY_MAX) return s
      const cell = { id: `d${s.n}`, label: PLAY_LETTERS[s.n % PLAY_LETTERS.length] }
      // stack pushes onto the top (exit end = index 0); queue enqueues at the back (end)
      return {
        cells: isStack ? [cell, ...s.cells] : [...s.cells, cell],
        n: s.n + 1,
      }
    })
  // both leave from the exit end (index 0): stack pop / queue dequeue
  const remove = () => setPlay((s) => ({ ...s, cells: s.cells.slice(1) }))

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {isStack ? "Play with the stack" : "Play with the queue"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {isStack
            ? "Push cards on, pop them off. They go in and out the same end, the top."
            : "Add at the back, remove from the front. The oldest one always leaves first."}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        <Container discipline={discipline} cells={play.cells} />
      </div>

      <div className="mb-4 flex gap-3">
        <Button
          variant="soft"
          className="flex-1"
          onClick={add}
          disabled={play.cells.length >= PLAY_MAX}
        >
          {isStack ? "Push" : "Enqueue"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={remove}
          disabled={play.cells.length === 0}
        >
          {isStack ? "Pop" : "Dequeue"}
        </Button>
      </div>

      <Button
        variant="tactile"
        size="lg"
        className="mt-auto w-full"
        onClick={() => dispatch({ type: "continue" })}
      >
        Continue
      </Button>
    </div>
  )
}

/* -------------------------------- teach beat -------------------------------- */

function TeachPart({
  discipline,
  dispatch,
}: {
  discipline: Discipline
  dispatch: Dispatch<LessonAction>
}) {
  const isStack = discipline === "stack"
  const cells: Cell[] = isStack
    ? [
        { id: "C", label: "C" },
        { id: "B", label: "B" },
        { id: "A", label: "A" },
      ]
    : [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
      ]

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {isStack ? "This is a stack" : "This is a queue"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {isStack ? (
            <>
              <span className="font-semibold text-foreground">Last in, first out.</span>{" "}
              One opening: cards go in and come out the same end, the top.
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">First in, first out.</span>{" "}
              Two ends: items enter the back and leave from the front.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        <BuildingContainer
          discipline={discipline}
          cells={cells}
          arrival={(isStack ? [...cells].reverse() : cells).map((c) => c.id)}
        />
      </div>

      <Button
        variant="tactile"
        size="lg"
        className="mt-auto w-full"
        onClick={() => dispatch({ type: "continue" })}
      >
        Continue
      </Button>
    </div>
  )
}

/* ------------------------------- predict beats ------------------------------ */

function PredictPart({
  state,
  dispatch,
}: {
  state: SQState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question as PredictQuestion
  const { feedback, selected, showWhy } = state
  const terminal = isTerminal(state)
  const reduce = !!useReducedMotion()
  const revealing = feedback === "correct" || (feedback === "fail" && showWhy)

  const isAfterK = q.ask.kind === "after-k"
  const k = q.ask.kind === "after-k" ? q.ask.k : 0

  // First-out themes build in over arrival order; after-k drives its own preview.
  const built = useBuildIn(q.arrival)
  const ready = built >= q.arrival.length
  const visible = new Set(q.arrival.slice(0, built))
  const builtCells = q.cells.filter((c) => visible.has(c.id))

  // after-k: a LOCAL pop-preview scrubbed via the shared StepTransport (the
  // engine is untouched). While answering, the scrub caps at k-1 so the learner
  // predicts the k-th; on reveal it replays all k pops (snapping if reduced).
  const [previewStep, setPreviewStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!isAfterK || !revealing) return
    if (reduce) {
      setPlaying(false)
      setPreviewStep(k)
      return
    }
    setPreviewStep(0)
    let step = 0
    const id = setInterval(() => {
      step += 1
      setPreviewStep(step)
      if (step >= k) clearInterval(id)
    }, 560)
    return () => clearInterval(id)
  }, [isAfterK, revealing, reduce, k])

  useEffect(() => {
    if (!isAfterK || !playing || revealing) return
    if (previewStep >= k - 1) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setPreviewStep((p) => Math.min(k - 1, p + 1)), 620)
    return () => clearTimeout(id)
  }, [isAfterK, playing, revealing, previewStep, k])

  // First-out leave replay: hold the resolved "correct" state, then a beat later
  // let the exit cell actually leave (it is removed from the figure, so it
  // animates out the exit while the rest reflow). Reduced motion never advances
  // to the leaving phase: it rests on the verdict (green + check), the
  // meaningful end-state, with no motion. This is the fix for the old flicker
  // where the answer cell was greened AND faded at the same instant.
  const [popping, setPopping] = useState(false)
  useEffect(() => {
    if (isAfterK || !revealing || reduce) {
      setPopping(false)
      return
    }
    setPopping(false)
    const id = setTimeout(() => setPopping(true), LEAVE_BEAT_MS)
    return () => clearTimeout(id)
  }, [isAfterK, revealing, reduce])

  // after-k: the answer turns green only once the pops finish, so it is never
  // styled correct while still buried under the cells leaving above it.
  const afterKResolved = reduce || previewStep >= k

  const cellState = (id: string): AnswerState => {
    if (feedback === "correct") {
      if (isAfterK) return id === q.answer && afterKResolved ? "correct" : "default"
      return id === q.answer ? "correct" : "default"
    }
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      if (showWhy && id === q.answer && (!isAfterK || afterKResolved)) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  const onSelectCell = (id: string) => dispatch({ type: "select", letter: id })
  // Once the leaving phase begins, drop the exit cell from the plain container
  // so AnimatePresence runs its exit and the survivors reflow (settle).
  const containerCells = popping
    ? builtCells.filter((c) => c.id !== q.answer)
    : builtCells

  // The real-world skins transform the whole page: render full-bleed scenes with
  // their own integrated prompt + themed footer (dispatching the same actions),
  // instead of the boxed prompt + figure + FeedbackFooter layout.
  if (!isAfterK && (q.theme === "browser" || q.theme === "drivethru")) {
    const sceneProps = {
      cells: builtCells,
      arrival: q.arrival,
      selectable: !terminal && ready,
      cellState,
      onSelectCell,
      answerId: q.answer,
      popping,
      reducedMotion: reduce,
      prompt: q.prompt,
      feedback,
      showWhy,
      canCheck: selected != null,
      copy: q,
      dispatch,
    }
    if (q.theme === "browser") return <BrowserShowpiece {...sceneProps} />
    if (REALWORLD_QUEUE_SKIN === "drivethru") return <DriveThruLane {...sceneProps} />
  }

  let figure: ReactNode
  if (isAfterK) {
    // Pops removed so far: capped at k-1 while answering, the full k on reveal.
    const popped = revealing ? Math.min(previewStep, k) : Math.min(previewStep, k - 1)
    figure = (
      <div className="flex flex-col items-center gap-5">
        <Container
          discipline={q.discipline}
          cells={q.cells.slice(popped)}
          selectable={!terminal}
          cellState={cellState}
          onSelectCell={onSelectCell}
          answerId={q.answer}
        />
        {!terminal && (
          <StepTransport
            index={Math.min(previewStep, k - 1)}
            total={k}
            playing={playing}
            onPlayToggle={() => setPlaying((p) => !p)}
            onPrev={() => {
              setPlaying(false)
              setPreviewStep((p) => Math.max(0, p - 1))
            }}
            onNext={() => {
              setPlaying(false)
              setPreviewStep((p) => Math.min(k - 1, p + 1))
            }}
            onReplay={() => {
              setPlaying(false)
              setPreviewStep(0)
            }}
          />
        )}
      </div>
    )
  } else if (q.theme === "drivethru" || q.theme === "printer") {
    figure = (
      <PrinterShowpiece
        cells={builtCells}
        selectable={!terminal && ready}
        cellState={cellState}
        onSelectCell={onSelectCell}
        answerId={q.answer}
        popping={popping}
        reducedMotion={reduce}
      />
    )
  } else {
    figure = (
      <Container
        discipline={q.discipline}
        cells={containerCells}
        selectable={!terminal && ready}
        cellState={cellState}
        onSelectCell={onSelectCell}
        answerId={q.answer}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        <QuotaLine state={state} />
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
          {q.prompt}
        </h2>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">{figure}</div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        copy={q}
        dispatch={dispatch}
        hideFailHint
      />
    </div>
  )
}

/* ------------------------------ construct beat ------------------------------ */

/** How a card returns home when it's released anywhere but the drop zone. */
type MissMode = "glide" | "fade"

/** The pointer's viewport coords from a drag event (mouse / touch / pen). */
function viewportPoint(
  event: MouseEvent | TouchEvent | PointerEvent,
  info: PanInfo,
): { x: number; y: number } {
  if ("clientX" in event && typeof event.clientX === "number") {
    return { x: event.clientX, y: event.clientY }
  }
  const touch =
    (event as TouchEvent).changedTouches?.[0] ?? (event as TouchEvent).touches?.[0]
  if (touch) return { x: touch.clientX, y: touch.clientY }
  // PanInfo.point is page-relative; de-scroll to viewport as a last resort.
  return { x: info.point.x - window.scrollX, y: info.point.y - window.scrollY }
}

/**
 * A loose card the learner drags into the structure. It physically follows the
 * pointer (`drag`); on release it either lands (dropped over the glowing bin →
 * push) or returns home: a soft glide-back (`glide`) or a pop-out-and-respawn
 * (`fade`). A plain tap / Enter pushes it too: one action for keyboard, touch,
 * and reduced-motion, never a two-step "pick then place".
 */
function DraggableCard({
  id,
  label,
  order,
  reduce,
  missMode,
  hitTest,
  onActive,
  onPush,
  ariaLabel,
  layoutId,
}: {
  id: string
  label: string
  order: number
  reduce: boolean
  missMode: MissMode
  hitTest: (p: { x: number; y: number }) => boolean
  onActive: (dragging: boolean, over: boolean) => void
  onPush: () => void
  ariaLabel: string
  /** Shared-layout id so this card morphs into its bin cell on a push (handoff). */
  layoutId?: string
}) {
  const [fading, setFading] = useState(false)
  // Bumping the key remounts the button, resetting the drag offset to origin so
  // a faded card respawns exactly where it started.
  const [respawn, setRespawn] = useState(0)
  const draggedRef = useRef(false)

  // The wrapper carries `layout` so the loose row reflows smoothly when a
  // sibling is pushed (instead of the remaining cards jumping to fill the gap).
  return (
    <motion.div layout={!reduce} data-push-order={import.meta.env.DEV ? order : undefined}>
      <motion.button
        key={respawn}
        layoutId={fading ? undefined : layoutId}
        type="button"
        data-construct-card={id}
        aria-label={ariaLabel}
        drag={!fading}
        dragSnapToOrigin={missMode === "glide"}
        dragMomentum={false}
        dragElastic={0.18}
        whileDrag={{ scale: 1.08, zIndex: 50, cursor: "grabbing" }}
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={fading ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 28 }
        }
        onPointerDown={() => {
          draggedRef.current = false
        }}
        onDragStart={() => {
          draggedRef.current = true
          onActive(true, false)
        }}
        onDrag={(event, info) => onActive(true, hitTest(viewportPoint(event, info)))}
        onDragEnd={(event, info) => {
          const hit = hitTest(viewportPoint(event, info))
          onActive(false, false)
          if (hit) onPush()
          else if (missMode === "fade") setFading(true)
          // glide: dragSnapToOrigin animates it home, nothing to do.
        }}
        onAnimationComplete={() => {
          if (fading) {
            setFading(false)
            setRespawn((r) => r + 1)
          }
        }}
        onClick={() => {
          if (!draggedRef.current) onPush()
        }}
        className={cn(
          "flex h-14 min-w-14 touch-none cursor-grab select-none items-center justify-center rounded-xl border-2 border-border bg-card px-3 text-lg font-bold text-foreground shadow-soft outline-none",
          "hover:border-lilac-strong/45 active:cursor-grabbing",
          "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {label}
      </motion.button>
    </motion.div>
  )
}

function ConstructPart({
  state,
  dispatch,
}: {
  state: SQState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question as ConstructQuestion
  const work = state.construct!
  const reduce = useReducedMotion()
  const terminal = isTerminal(state)
  const ready = constructReady(state)
  const labels = Object.fromEntries(q.target.map((c) => [c.id, c.label]))

  // Pushed cells in container order (stack: newest on top → reverse the push order).
  const pushedCells: Cell[] = (q.discipline === "stack" ? [...work.pushed].reverse() : work.pushed).map(
    (id) => ({ id, label: labels[id] }),
  )

  // On a correct build, drain the structure so the learner *sees* the exit order.
  const [out, setOut] = useState(0)
  useEffect(() => {
    if (state.feedback !== "correct") {
      setOut(0)
      return
    }
    if (reduce) {
      setOut(pushedCells.length)
      return
    }
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setOut(i)
      if (i >= pushedCells.length) clearInterval(timer)
    }, 480)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.feedback, reduce, pushedCells.length])

  const shownCells = pushedCells.slice(out)

  // The drop zone lives at the bin's opening (top for a stack, back for a queue);
  // `dropRef` points at it so we hit-test that exact area and cards fall from it.
  const dropRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState(false)
  const [missMode, setMissMode] = useState<MissMode>("glide")

  // `building` = the learner can still add cards (keep the drop zone mounted so
  // the final card still falls from it); `canDrop` also requires a legal target.
  const building = !terminal && state.feedback !== "correct"
  const canDrop = building && legalTargets(state).has("mouth")
  const zoneLabel = q.discipline === "stack" ? "the stack" : "the queue"

  // Forgiving geometry hit-test against the live drop-zone rect (viewport space).
  const hitTest = (p: { x: number; y: number }) => {
    const el = dropRef.current
    if (!el) return false
    const r = el.getBoundingClientRect()
    const tol = 40
    return (
      p.x >= r.left - tol && p.x <= r.right + tol && p.y >= r.top - tol && p.y <= r.bottom + tol
    )
  }

  const onActive = (isDragging: boolean, isOver: boolean) => {
    setDragging(isDragging)
    setOver(isDragging && isOver)
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mt-7">
        <QuotaLine state={state} />
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
          {q.prompt}
        </h2>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Goal: leaves as</span>
          {q.target.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-xs font-bold text-foreground">
                {c.label}
              </span>
              {i < q.target.length - 1 && (
                <ArrowRight className="size-3 text-faint" strokeWidth={2.5} />
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
        <Container
          discipline={q.discipline}
          cells={shownCells}
          layoutIdFor={(id) => (reduce ? undefined : `construct-${id}`)}
          dropRef={building ? dropRef : undefined}
          dropActive={canDrop && dragging}
          dropOver={canDrop && over}
        />

        {work.loose.length > 0 && !terminal && state.feedback !== "correct" && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              {work.loose.map((id) => (
                <DraggableCard
                  key={id}
                  id={id}
                  label={labels[id]}
                  order={q.correctPush.indexOf(id)}
                  reduce={!!reduce}
                  missMode={missMode}
                  hitTest={hitTest}
                  onActive={onActive}
                  onPush={() => dispatch({ type: "rewire", from: id, to: "mouth" })}
                  ariaLabel={`Add ${labels[id]} to ${zoneLabel}`}
                  layoutId={reduce ? undefined : `construct-${id}`}
                />
              ))}
            </div>
            {!dragging && (
              <span className="text-xs font-medium text-faint">
                Drag a card into {zoneLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <FeedbackFooter
        feedback={state.feedback}
        selected={null}
        showWhy={state.showWhy}
        copy={q}
        dispatch={dispatch}
        canCheck={ready}
        hideFailHint
      />

      {import.meta.env.DEV && work.loose.length > 0 && !terminal && (
        <button
          type="button"
          onClick={() => setMissMode((m) => (m === "glide" ? "fade" : "glide"))}
          className="absolute right-2 top-2 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          miss · {missMode}
        </button>
      )}
    </div>
  )
}

/* ------------------------------- compare beat ------------------------------- */

function ComparePart({
  state,
  dispatch,
}: {
  state: SQState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question as ClassifyQuestion | ContrastQuestion
  const { feedback, selected, showWhy } = state
  const terminal = isTerminal(state)
  const reduce = !!useReducedMotion()
  const revealing = feedback === "correct" || (feedback === "fail" && showWhy)

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
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        <QuotaLine state={state} />
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
          {q.prompt}
        </h2>
      </div>

      <div className="flex justify-center py-5">
        {q.kind === "classify" ? (
          <ClassifyReplay
            inOrder={q.inOrder}
            outOrder={q.outOrder}
            verdict={q.answer as "stack" | "queue" | "neither"}
            replay={revealing}
            reducedMotion={reduce}
            srLabel={revealing ? classifySrLabel(q) : undefined}
          />
        ) : (
          <ContrastReplay
            arrival={q.arrival}
            target={q.target}
            winner={q.answer as Discipline}
            replay={revealing}
            reducedMotion={reduce}
            srLabel={revealing ? contrastSrLabel(q) : undefined}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 pb-6">
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

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        copy={q}
        dispatch={dispatch}
        hideFailHint
      />
    </div>
  )
}

/** The SR-only verdict for the classify replay (shown only once revealed). */
function classifySrLabel(q: ClassifyQuestion): string {
  if (q.answer === "stack")
    return "Out is the exact reverse of in, which is last in, first out. A stack."
  if (q.answer === "queue")
    return "Out keeps the same order as in, which is first in, first out. A queue."
  return "Out is neither a clean reverse nor the same order, so no single structure produces it."
}

function nth(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const ones = n % 10
  return `${n}${ones === 1 ? "st" : ones === 2 ? "nd" : ones === 3 ? "rd" : "th"}`
}

/** The SR-only verdict for the contrast replay (the badge shows icon + text). */
function contrastSrLabel(q: ContrastQuestion): string {
  const stackStep = targetEmitStep(q.arrival, q.target, "stack")
  const queueStep = targetEmitStep(q.arrival, q.target, "queue")
  const winnerLabel = q.answer === "stack" ? "Stack" : "Queue"
  return `${winnerLabel} hands you ${q.target} first: ${nth(stackStep)} vs ${nth(queueStep)}.`
}
