import type { Dispatch } from "react"

import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction } from "@/features/lesson/engine"
import {
  constructReadyA,
  currentPartArrays,
  isTerminalA,
  legalTargetsArrays,
  partQuotaArrays,
  shiftFrames,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { ArrayStrip, type Overlay } from "./ArrayStrip"
import { CapacityFrame } from "./CapacityFrame"
import { SpreadsheetInsert } from "./SpreadsheetInsert"

/**
 * The redesigned Arrays stage: a switch over the 11 beats. The core figure is
 * the contiguous ArrayStrip + address ruler (the spreadsheet skin and the
 * capacity frame specialize two beats in later slices). All verdict UX flows
 * through the shared FeedbackFooter with the SR-only fail copy (no fail sentence).
 */
export function ArraysStage({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  switch (currentPartArrays(state)) {
    case "demo":
    case "teach-access":
    case "shift-demo":
    case "teach-shift":
      return <IntroPart state={state} dispatch={dispatch} />
    case "a1-access":
    case "a3-contrast":
      return <AccessPart state={state} dispatch={dispatch} />
    case "a2-shift":
    case "a2-skin":
      return <ShiftPart state={state} dispatch={dispatch} />
    case "a4-classify":
      return <ClassifyPart state={state} dispatch={dispatch} />
    case "a5-construct":
      return <ConstructPart state={state} dispatch={dispatch} />
    case "a6-grow":
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
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
        {prompt}
      </h2>
    </div>
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

/* ------------------------------ intro / teach ----------------------------- */

function IntroPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const part = currentPartArrays(state)
  const isAccess = part === "demo" || part === "teach-access"
  const heading =
    part === "demo"
      ? "Arrays: a contiguous block"
      : part === "teach-access"
        ? "Instant access"
        : part === "shift-demo"
          ? "Inserting and deleting"
          : "The shift cascade"

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">{heading}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <ArrayStrip mode="read" cells={q.cells} />
        <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
          {isAccess
            ? "The number under each cell is its index, the address. arr[k] jumps straight there."
            : "Cells touch with no gaps, so a middle insert or delete must slide its neighbours over."}
        </p>
      </div>

      <div className="mt-auto">
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() => dispatch({ type: "continue" })}
        >
          Continue
        </Button>
      </div>
    </StageCenter>
  )
}

/* --------------------------- A1 + A3 (de-cued access) --------------------------- */

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
  const overlay: Overlay = reveal
    ? q.ask === "value"
      ? { kind: "scan", to: ansIdx }
      : { kind: "jump", k: ansIdx }
    : null
  const quota = partQuotaArrays(state)

  return (
    <StageCenter>
      <Header kicker={q.ask === "value" ? "Access vs search" : "Access"} prompt={q.prompt} />
      {quota && (
        <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
          {quota.done} / {quota.total}
        </p>
      )}

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
        {reveal && (
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        )}
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          {q.ask === "value"
            ? "Without the index there's no jump - scan from the front."
            : "Read the ruler, then tap the cell at that address."}
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/* ------------------------------ A2 + A2 skin (shift) ----------------------------- */

function ShiftPart({
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
  const isSkin = currentPartArrays(state) === "a2-skin"
  const quota = partQuotaArrays(state)

  // Post-verdict ripple: the wave of one-slot shifts reveals the resulting row.
  const frames = q.op ? shiftFrames(q.cells, q.op) : []
  const lastFrame = frames[frames.length - 1]

  return (
    <StageSplit
      header={
        <>
          <Header kicker={isSkin ? "Real-world · row insert" : "Shift"} prompt={q.prompt} />
          {quota && (
            <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
              {quota.done} / {quota.total}
            </p>
          )}
        </>
      }
      figure={
        <div className="flex flex-col items-center gap-3 py-4">
          {isSkin && q.op ? (
            <SpreadsheetInsert cells={q.cells} op={q.op} reveal={reveal} />
          ) : reveal && lastFrame ? (
            <ArrayStrip mode="ripple" frame={lastFrame} opIndex={q.op?.index ?? -1} />
          ) : (
            <ArrayStrip mode="read" cells={q.cells} highlight={q.op?.index ?? -1} tone="active" />
          )}
          {reveal && (
            <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
          )}
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
            copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}

/* ------------------------------- A4 (classify) ------------------------------ */

function ClassifyPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || !q.options || !q.classify) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalA(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const { n, midK } = q.classify
  const quota = partQuotaArrays(state)

  return (
    <StageSplit
      header={
        <>
          <Header kicker="Classify by position" prompt={q.prompt} />
          {quota && (
            <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
              {quota.done} / {quota.total}
            </p>
          )}
        </>
      }
      figure={
        <div className="flex flex-col items-center gap-3 py-4">
          <ArrayStrip mode="read" cells={q.cells} />
          {reveal && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <LabeledCost label="Front" count={n} />
              <LabeledCost label="Middle" count={n - midK} />
              <LabeledCost label="End" count={0} />
            </div>
          )}
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
            copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
            dispatch={dispatch}
          />
        </>
      }
    />
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

/* ------------------------------ A5 (construct) ------------------------------ */

function ConstructPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || !state.construct) return null
  const { feedback, showWhy } = state
  const ready = constructReadyA(state)

  return (
    <StageCenter>
      <Header kicker="Construct" prompt={q.prompt} />

      <div className="my-2 flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Target row
        </span>
        <ArrayStrip mode="read" cells={q.target ?? []} ruler={false} />
      </div>

      <div className="flex flex-1 flex-col justify-center py-3">
        <RewireSurface
          legalTargets={legalTargetsArrays(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label="Append a loose cell to the open end of the row"
          className="flex flex-col items-center"
        >
          <ArrayStrip
            mode="construct"
            partial={q.partial ?? []}
            placed={state.construct.placed}
            loose={state.construct.loose}
            correctOps={q.correctOps ?? []}
          />
        </RewireSurface>
      </div>

      {feedback === "correct" && (
        <div className="mb-4 flex justify-center">
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        </div>
      )}

      <FeedbackFooter
        feedback={feedback}
        selected={null}
        canCheck={ready}
        showWhy={showWhy}
        hideFailHint
        copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/* -------------------------------- A6 (grow) -------------------------------- */

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
  const quota = partQuotaArrays(state)

  return (
    <StageSplit
      header={
        <>
          <Header kicker="Grow · dynamic array" prompt={q.prompt} />
          {quota && (
            <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
              {quota.done} / {quota.total}
            </p>
          )}
        </>
      }
      figure={
        <div className="flex flex-col items-center gap-3 py-4">
          {q.resize && <CapacityFrame resize={q.resize} cells={q.cells} reveal={reveal} />}
          {reveal && (
            <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
          )}
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
            copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}
