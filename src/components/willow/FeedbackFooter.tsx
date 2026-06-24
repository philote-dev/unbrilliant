import type { Dispatch } from "react"

import { Button } from "@/components/ui/button"
import { StatusChip } from "@/components/willow/StatusChip"
import type {
  Feedback,
  LessonAction,
  QuestionCopy,
} from "@/features/lesson/engine"

/**
 * The shared verdict footer used by every lesson: hint + Check while idle, a
 * nudge on a first wrong, the correction + Continue on a correct verdict, and
 * the Why?/Reattempt pair on a full fail. Driven entirely by generic feedback
 * state + per-question copy, so it works across S&Q, Arrays, and beyond.
 */
export function FeedbackFooter({
  feedback,
  selected,
  showWhy,
  copy,
  dispatch,
  canCheck,
  hideFailHint,
}: {
  feedback: Feedback
  selected: string | null
  showWhy: boolean
  copy: QuestionCopy
  dispatch: Dispatch<LessonAction>
  /** Override the Check gate (e.g. construct: ready once all cells are pushed).
   * When omitted, Check enables on any selection (the default for MCQ lessons). */
  canCheck?: boolean
  /** Drop the visible fail hint line, leaving the buttons + a screen-reader-only
   * status to carry the meaning (S&Q opts in; other lessons keep the line). */
  hideFailHint?: boolean
}) {
  return (
    <div className="mt-auto min-h-[132px]">
      {feedback === "correct" && (
        <div className="animate-fade-in">
          <FeedbackChip chip="correct" text={copy.correct} />
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "next" })}
          >
            Continue
          </Button>
        </div>
      )}

      {feedback === "nudge" && (
        <div className="animate-fade-in">
          <FeedbackChip chip="hint" text={copy.nudge} />
          <CheckButton selected={selected} dispatch={dispatch} canCheck={canCheck} />
        </div>
      )}

      {feedback === "fail" && (
        <div className="animate-fade-in">
          {hideFailHint && !showWhy ? (
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <StatusChip status="fail" />
              <p role="status" className="sr-only">
                Try again — tap Why for the answer, or reattempt.
              </p>
            </div>
          ) : (
            <FeedbackChip
              chip="fail"
              text={
                showWhy ? copy.why : "Not quite — tap Why for the answer, or reattempt."
              }
            />
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
            >
              Why?
            </Button>
            <Button
              variant="soft"
              size="lg"
              className="flex-1"
              onClick={() => dispatch({ type: "reattempt" })}
            >
              Reattempt
            </Button>
          </div>
        </div>
      )}

      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm text-muted-foreground">
            {copy.hint}
          </p>
          <CheckButton selected={selected} dispatch={dispatch} canCheck={canCheck} />
        </>
      )}
    </div>
  )
}

export function CheckButton({
  selected,
  dispatch,
  canCheck,
}: {
  selected: string | null
  dispatch: Dispatch<LessonAction>
  canCheck?: boolean
}) {
  const disabled = canCheck !== undefined ? !canCheck : selected == null
  return (
    <Button
      variant="tactile"
      size="lg"
      className="w-full"
      disabled={disabled}
      onClick={() => dispatch({ type: "check" })}
    >
      Check
    </Button>
  )
}

function FeedbackChip({
  chip,
  text,
}: {
  chip: "correct" | "hint" | "fail"
  text: string
}) {
  return (
    <div className="mb-4 flex flex-col items-center gap-2 text-center">
      <StatusChip status={chip} />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
