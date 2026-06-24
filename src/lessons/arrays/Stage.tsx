import type { Dispatch } from "react"

import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import type { LessonAction } from "@/features/lesson/engine"
import {
  currentPartArrays,
  isTerminalA,
  partQuotaArrays,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { ArrayRow } from "./ArrayRow"

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
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Arrays: instant access
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {q.prompt}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <ArrayRow
          cells={q.array}
          highlight={accessed ?? -1}
          onTap={(i) => dispatch({ type: "select", letter: String(i) })}
        />
        {accessed != null && (
          <CostReadout word="free" count={1} unit="step" />
        )}
      </div>

      <div className="mt-auto">
        {accessed != null && (
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Index {accessed} → {q.array[accessed]}. A direct hit: one step, no
            matter how big the array grows.
          </p>
        )}
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() => dispatch({ type: "continue" })}
        >
          Continue
        </Button>
      </div>
    </div>
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

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === q.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      // The learner's own wrong pick reads red; the correct answer is revealed
      // (in green) only once they ask Why — never auto-revealed on the miss.
      if (showWhy && id === q.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        {quota && (
          <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
            {quota.done} / {quota.total} correct
          </p>
        )}
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
          {q.prompt}
        </h2>
      </div>

      {q.array.length > 0 && (
        <div className="mt-5 flex justify-center">
          <ArrayRow cells={q.array} highlight={q.highlight} />
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center gap-3 py-6">
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

      {feedback === "correct" && (
        <div className="mb-4 flex justify-center">
          <CostReadout
            word={q.cost.word}
            count={q.cost.count}
            unit={q.cost.unit}
          />
        </div>
      )}

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        copy={{
          prompt: q.prompt,
          hint: q.hint,
          nudge: q.nudge,
          correct: q.correct,
          why: q.why,
        }}
        dispatch={dispatch}
      />
    </div>
  )
}
