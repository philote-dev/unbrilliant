import { useState, type Dispatch } from "react"

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

function Header({ kicker, prompt }: { kicker: string; prompt: string }) {
  return (
    <div className="mt-7">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
        {kicker}
      </p>
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">
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

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground lg:text-2xl">Arrays: one contiguous block</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          Tap any cell. The number beneath is its address, and arr[k] jumps straight there.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <ArrayStrip
          mode="read"
          cells={PLAY_CELLS}
          highlight={touched}
          tone="active"
          overlay={touched >= 0 ? ({ kind: "jump", k: touched } as Overlay) : null}
          onTap={setTouched}
        />
        <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
          {touched >= 0
            ? `arr[${touched}] = ${PLAY_CELLS[touched]}. One hop from the ruler, no walking.`
            : "The cells touch with no gaps, so every address is one jump away."}
        </p>
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
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
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          {isScan
            ? "No index in hand: scan from the front until the value matches."
            : "Read the ruler, then tap the cell at that address."}
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
    <StageCenter>
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground lg:text-2xl">Inserting and deleting</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          Insert at a position, or tap a cell to delete it, and watch the rest slide over to stay contiguous.
        </p>
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
        <p className="mx-auto max-w-xs text-center text-xs text-muted-foreground">
          A middle change shifts every cell after it. The end shifts nothing.
        </p>
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
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
