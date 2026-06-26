import { useState, type Dispatch, type ReactNode } from "react"

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
import { ArrayRow } from "./ArrayRow"
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
    case "scan":
      return <AccessPart state={state} dispatch={dispatch} />
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

/* --------------------------- jump + scan (de-cued access) --------------------------- */

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
  const isScan = currentPartArrays(state) === "scan"
  const selIdx = selected != null ? Number(selected) : -1
  const ansIdx = q.answerIndex ?? -1
  const highlight = reveal ? ansIdx : selIdx
  const tone = reveal ? "correct" : feedback === "nudge" || feedback === "fail" ? "wrong" : "active"
  const overlay: Overlay = reveal
    ? isScan
      ? { kind: "scan", to: ansIdx }
      : { kind: "jump", k: ansIdx }
    : null

  return (
    <StageCenter>
      <Header kicker={isScan ? "Search by value" : "Jump by index"} prompt={q.prompt} />
      <Quota state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
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
          {isScan ? (
            <>
              No index in hand: <span className="concept">scan</span> from the front until the value matches.
            </>
          ) : (
            <>
              Find the <span className="concept">index</span>, then tap that cell.
            </>
          )}
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

/* ------------------------------ play: mutation ----------------------------- */

const MUTATE_POOL = ["A", "B", "C", "D", "E", "F", "G", "H"]

function PlayMutatePart({ dispatch }: { dispatch: Dispatch<LessonAction> }) {
  const [cells, setCells] = useState(["A", "B", "C", "D"])
  const [k, setK] = useState(2)
  const full = cells.length >= MUTATE_POOL.length
  const at = Math.min(k, cells.length)

  const insert = () => {
    if (full) return
    const free = MUTATE_POOL.find((l) => !cells.includes(l))
    if (!free) return
    setCells((prev) => [...prev.slice(0, at), free, ...prev.slice(at)])
  }
  const remove = (i: number) => setCells((prev) => prev.filter((_, j) => j !== i))

  return (
    <StageCenter maxWidthClass="max-w-xl">
      <div className="mt-8 text-center animate-fade-in">
        <Eyebrow>Insert & delete</Eyebrow>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
          Make room, close gaps
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <ArrayRow cells={cells} onTap={remove} />
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

/* --------------------------- insert / delete / realworld (predict the count) --------------------------- */

function CountPart({
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
  const part = currentPartArrays(state)
  const isRealworld = part === "realworld"

  const frames = q.op ? shiftFrames(q.cells, q.op) : []
  const lastFrame = frames[frames.length - 1]
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
          ) : reveal && lastFrame ? (
            <ArrayStrip mode="ripple" frame={lastFrame} opIndex={q.op?.index ?? -1} />
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
