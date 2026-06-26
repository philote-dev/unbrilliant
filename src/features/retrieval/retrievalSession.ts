import { gradeAnswer, type Feedback } from "@/features/lesson/engine"
import type { RetrievalItem } from "@/features/retrieval/itemProvider"

/**
 * Pure reducer for a single-topic retrieval drill. Reuses the shared `gradeAnswer`
 * feedback machine + combo so feedback and flame behave exactly like a lesson. No
 * I/O: the view calls `recordReview` when an item reaches a terminal verdict.
 */
export interface RetrievalState {
  items: RetrievalItem[]
  index: number
  selected: string | null
  feedback: Feedback
  wrongCount: number
  revealed: boolean
  combo: number
  results: boolean[] // one entry per item once it terminalizes
  done: boolean
}

export type RetrievalAction =
  | { type: "select"; optionId: string }
  | { type: "check" }
  | { type: "next" }

const FRESH = {
  selected: null,
  feedback: "idle" as Feedback,
  wrongCount: 0,
  revealed: false,
}

export function createRetrieval(items: RetrievalItem[]): RetrievalState {
  return {
    items,
    index: 0,
    combo: 0,
    results: [],
    done: items.length === 0,
    ...FRESH,
  }
}

const isTerminal = (f: Feedback) => f === "correct" || f === "fail"

export function retrievalReducer(
  state: RetrievalState,
  action: RetrievalAction,
): RetrievalState {
  if (state.done) return state
  const item = state.items[state.index]
  switch (action.type) {
    case "select":
      if (isTerminal(state.feedback)) return state
      return { ...state, selected: action.optionId, feedback: "idle" }
    case "check": {
      if (state.selected == null || isTerminal(state.feedback)) return state
      const correct = state.selected === item.answerId
      const v = gradeAnswer(state, correct)
      return {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        results: isTerminal(v.feedback) ? [...state.results, correct] : state.results,
      }
    }
    case "next": {
      if (!isTerminal(state.feedback)) return state
      const index = state.index + 1
      if (index >= state.items.length) return { ...state, done: true }
      return { ...state, index, ...FRESH }
    }
  }
}
