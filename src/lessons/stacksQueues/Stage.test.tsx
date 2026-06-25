import { useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  resumeStacksQueues,
  stacksQueuesReducer,
  type SQPart,
  type SQState,
} from "@/features/lesson/stacksQueuesEngine"
import { StacksQueuesStage } from "./Stage"

/**
 * DOM tests for the Stacks & Queues stage. Reduced motion is forced (matchMedia
 * matches), so every figure parks on its snapped end-state with no timers: in
 * particular the predict "leave replay" never advances past the resolved verdict
 * (green + check), which is exactly the sequencing the redesign demands (show the
 * correct state, settle, never flicker the cell out from under the green). They
 * also cover the new real-world skins and the compare resolving motion, plus the
 * no-answer-leak guarantee.
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

function Harness({ initial }: { initial: SQState }) {
  const [state, dispatch] = useReducer(stacksQueuesReducer, initial)
  return <StacksQueuesStage state={state} dispatch={dispatch} />
}

const stateAt = (part: SQPart): SQState =>
  resumeStacksQueues({ counters: {}, currentPart: part, completed: false }, SEED)

const apply = (s: SQState, ...actions: Parameters<typeof stacksQueuesReducer>[1][]): SQState =>
  actions.reduce(stacksQueuesReducer, s)

/** Tap the dev-marked winning option / cell, then Check. */
const clickCorrect = () => {
  fireEvent.click(document.querySelector('[data-answer="1"]') as HTMLElement)
  fireEvent.click(screen.getByRole("button", { name: "Check" }))
}

describe("S&Q stage: browser-back skin", () => {
  it("renders the browser window and marks the page that leaves", () => {
    render(<Harness initial={stateAt("stack-realworld")} />)
    expect(screen.getByTestId("browser-showpiece")).toBeInTheDocument()
    expect(document.querySelectorAll('[data-answer="1"]')).toHaveLength(1)
    // nothing is revealed before the learner answers
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("on a correct pick, shows the verdict and keeps the structure settled (no flicker pop)", () => {
    render(<Harness initial={stateAt("stack-realworld")} />)
    clickCorrect()
    // verdict reached: Continue is offered
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
    // reduced motion never advances to the leaving phase: the answer stays put,
    // shown correct (green + check), rather than being faded out at the same time
    const history = screen.getByTestId("browser-history")
    const marked = history.querySelector('[data-answer="1"]') as HTMLElement
    expect(marked).not.toBeNull()
    expect(marked.querySelector("svg")).not.toBeNull() // the success check icon
  })
})

describe("S&Q stage: drive-thru skin", () => {
  it("renders the lane and marks the front car (served first)", () => {
    render(<Harness initial={stateAt("queue-realworld")} />)
    expect(screen.getByTestId("drivethru-lane")).toBeInTheDocument()
    expect(document.querySelectorAll('[data-answer="1"]')).toHaveLength(1)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("on a correct pick, holds the verdict with nothing served yet (no flicker pop)", () => {
    render(<Harness initial={stateAt("queue-realworld")} />)
    clickCorrect()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
    // reduced motion: the front car rests at the window shown correct, not pulled
    // away, so the Served slot is still empty
    expect(
      screen.getByTestId("drivethru-served").querySelectorAll("[data-cell]"),
    ).toHaveLength(0)
  })
})

describe("S&Q stage: compare resolving motion", () => {
  it("classify shows no verdict until answered, then plays the resolve", () => {
    render(<Harness initial={stateAt("compare")} />)
    expect(screen.getByTestId("classify-replay")).toBeInTheDocument()
    expect(screen.queryByTestId("classify-verdict")).toBeNull()

    clickCorrect()
    expect(screen.getByTestId("classify-verdict")).toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("contrast races a stack vs a queue and crowns the earlier emitter", () => {
    const contrast = apply(
      stateAt("compare"),
      { type: "select", letter: stateAt("compare").question!.answer },
      { type: "check" },
      { type: "next" },
    )
    render(<Harness initial={contrast} />)
    expect(screen.getByTestId("contrast-replay")).toBeInTheDocument()
    expect(screen.queryByTestId("contrast-winner")).toBeNull()

    clickCorrect()
    expect(screen.getByTestId("contrast-winner")).toBeInTheDocument()
  })
})

describe("S&Q stage: de-cued stack predict", () => {
  it("marks the after-two-pops answer and resolves it correct", () => {
    render(<Harness initial={stateAt("stack-predict")} />)
    expect(document.querySelectorAll('[data-answer="1"]').length).toBeGreaterThanOrEqual(1)
    clickCorrect()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})
