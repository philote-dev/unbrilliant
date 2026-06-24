import { type Dispatch } from "react"
import { Shuffle } from "lucide-react"

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
import { ParkingLot, type ParkingScene } from "./ParkingLot"

/**
 * The Arrays stage, skinned end-to-end as a vivid parking lot: the bay number is
 * the index, a parked car is the value, and the cost of an op is felt as cars
 * rolling between bays (the ParkingLot owns that choreography). The lot is the
 * live structure across all four beats; the verdict UX still flows through the
 * shared AnswerCard / FeedbackFooter / CostReadout, and the cost chip is rendered
 * from the engine's `q.cost` verbatim so the locked house words never drift.
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
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Arrays: instant access
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {q.prompt}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-faint">
          Each bay is an index; the car parked in it is the value.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <ParkingLot
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

      <div className="mt-auto">
        {accessed != null && (
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Bay {accessed} holds {q.array[accessed]}. A direct hit: pull straight
            in, no matter how big the lot grows.
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
        {/* Re-roll a fresh instance. Gated to the pristine idle state so it can
            never dodge a graded verdict or the until-correct mastery wall. */}
        {feedback === "idle" && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => dispatch({ type: "reattempt" })}
              aria-label="Regenerate this example"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Shuffle className="size-3.5" /> New example
            </button>
          </div>
        )}
      </div>

      {scene && (
        <div className="mt-6 flex justify-center">
          <ParkingLot scene={scene} />
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

      {reveal && (
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
