import { useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  arraysReducer,
  resumeArrays,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { ArraysStage } from "./Stage"

/**
 * DOM tests for the Arrays stage. Reduced motion is forced (matchMedia matches),
 * so the post-verdict step players park on their snapped end-state with no
 * timers, keeping these deterministic. They cover the seams that matter: the
 * idle-only regenerate gate, the POST-VERDICT wave + transport (never before),
 * and the locked cost-chip words.
 */
beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
})

const SEED = 7

function Harness({ initial }: { initial: ArraysState }) {
  const [state, dispatch] = useReducer(arraysReducer, initial)
  return <ArraysStage state={state} dispatch={dispatch} />
}

/** A live state seeded at a chosen part with the prior quotas already met. */
function stateAt(part: "shift" | "cost" | "resize"): ArraysState {
  const counters: Record<string, number> = { shiftPredict: 3, costCount: 3 }
  if (part === "shift") return resumeArrays({ counters: {}, currentPart: "shift", completed: false }, SEED)
  return resumeArrays({ counters, currentPart: part, completed: false }, SEED)
}

/** Re-roll (in idle) until the resize instance lands on a chosen verdict. */
function resizeStateAnswering(answer: "yes" | "no"): ArraysState {
  let s = stateAt("resize")
  while (s.question!.answer !== answer) s = arraysReducer(s, { type: "reattempt" })
  return s
}

const clickCorrect = () => {
  const card = document.querySelector('[data-answer="1"]') as HTMLElement
  fireEvent.click(card)
  fireEvent.click(screen.getByRole("button", { name: "Check" }))
}

describe("Arrays stage — regenerate is gated to idle", () => {
  it("offers a re-roll while idle, and hides it once a verdict lands", () => {
    render(<Harness initial={stateAt("shift")} />)
    expect(screen.getByLabelText("Regenerate this example")).toBeInTheDocument()

    clickCorrect()
    // post-verdict: the re-roll is gone, so it can never dodge the mastery wall.
    expect(screen.queryByLabelText("Regenerate this example")).toBeNull()
  })

  it("a re-roll keeps the learner on the same part (no quota skip)", () => {
    render(<Harness initial={stateAt("shift")} />)
    fireEvent.click(screen.getByLabelText("Regenerate this example"))
    // still a fresh, ungraded shift predict: Check is back and re-roll is offered.
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument()
    expect(screen.getByLabelText("Regenerate this example")).toBeInTheDocument()
  })
})

describe("Arrays stage — shift wave mounts post-verdict", () => {
  it("shows no wave or transport before the verdict", () => {
    render(<Harness initial={stateAt("shift")} />)
    expect(screen.queryByTestId("shift-wave")).toBeNull()
    expect(screen.queryByRole("group", { name: "Shift playback" })).toBeNull()
  })

  it("reveals the wave, the playback transport, and the 'scales' chip once correct", () => {
    render(<Harness initial={stateAt("shift")} />)
    clickCorrect()

    expect(screen.getByTestId("shift-wave")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Shift playback" })).toBeInTheDocument()
    expect(screen.getByText("scales")).toBeInTheDocument()
  })
})

describe("Arrays stage — resize chip reads the house word", () => {
  it("a triggered resize shows the doubling block and the 'usually free' chip", () => {
    render(<Harness initial={resizeStateAnswering("yes")} />)
    clickCorrect()

    expect(screen.getByTestId("resize-block")).toBeInTheDocument()
    expect(screen.getByText("usually free")).toBeInTheDocument()
    expect(screen.queryByText("scales")).toBeNull()
  })

  it("a no-resize insert shows the 'free' chip", () => {
    render(<Harness initial={resizeStateAnswering("no")} />)
    clickCorrect()
    expect(screen.getByText("free")).toBeInTheDocument()
  })
})
