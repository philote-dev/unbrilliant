import { useEffect, useReducer, useRef } from "react"

import { Button } from "@/components/ui/button"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import {
  createRetrieval,
  retrievalReducer,
} from "@/features/retrieval/retrievalSession"
import type { RetrievalItem } from "@/features/retrieval/itemProvider"

/**
 * The pre-lesson warm-up. Mandatory attempt, non-blocking: the learner answers,
 * sees the correction, and proceeds. Each item reports through `recordReview` once
 * when it reaches a terminal verdict.
 */
export function RetrievalDrill({
  items,
  lessonName,
  onDone,
}: {
  items: RetrievalItem[]
  lessonName: string
  onDone: () => void
}) {
  const { recordReview } = useConceptReviews()
  const [state, dispatch] = useReducer(retrievalReducer, items, createRetrieval)
  const recordedRef = useRef<number>(-1)

  const item = state.items[state.index]
  const terminal = state.feedback === "correct" || state.feedback === "fail"
  const last = state.index + 1 >= state.items.length

  useEffect(() => {
    if (terminal && recordedRef.current !== state.index && item) {
      recordedRef.current = state.index
      recordReview(item.conceptId, state.feedback === "correct")
    }
  }, [terminal, state.index, state.feedback, item, recordReview])

  useEffect(() => {
    if (state.done) onDone()
  }, [state.done, onDone])

  if (state.done || !item) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <p className="text-sm font-medium text-muted-foreground">
        Quick warm-up from {lessonName}
      </p>
      <p className="text-lg">{item.prompt}</p>
      <div className="flex flex-col gap-2">
        {item.options.map((o) => (
          <Button
            key={o.id}
            variant={state.selected === o.id ? "soft" : "secondary"}
            disabled={terminal}
            onClick={() => dispatch({ type: "select", optionId: o.id })}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {state.feedback === "nudge" && (
        <p className="text-sm text-amber-600">
          Not quite. Take another look and try again.
        </p>
      )}

      {!terminal ? (
        <Button
          disabled={state.selected == null}
          onClick={() => dispatch({ type: "check" })}
        >
          Check
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">
              {state.feedback === "correct" ? "Correct. " : "Answer: "}
            </span>
            {item.why}
          </p>
          <Button onClick={() => dispatch({ type: "next" })}>
            {last ? `Continue to ${lessonName}` : "Next"}
          </Button>
        </div>
      )}
    </div>
  )
}
