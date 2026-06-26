import { useReducer } from "react"
import { describe, it, expect, beforeAll, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  resumeStacksQueues,
  stacksQueuesReducer,
  type SQPart,
  type SQState,
} from "@/features/lesson/stacksQueuesEngine"
import { StacksQueuesStage } from "./Stage"

// StacksQueuesStage now reads the signed-in user for the checkpoint overlay and
// renders that overlay at the concept boundaries. These beat tests seed
// mid-lesson states directly (so a boundary checkpoint would otherwise intercept
// them); stub auth and auto-dismiss the checkpoint, which has its own tests, to
// keep these focused on the beats.
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("./PolyCheckpoint", async () => {
  const { useLayoutEffect } = await import("react")
  return {
    PolyCheckpoint: ({
      onDone,
      conceptId,
    }: {
      onDone: () => void
      conceptId: string
    }) => {
      useLayoutEffect(() => {
        onDone()
      }, [conceptId, onDone])
      return null
    },
  }
})

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

describe("S&Q stage: printer skin", () => {
  it("renders the print queue and marks the front document (prints first)", () => {
    render(<Harness initial={stateAt("queue-realworld")} />)
    expect(screen.getByTestId("printer-showpiece")).toBeInTheDocument()
    expect(document.querySelectorAll('[data-answer="1"]')).toHaveLength(1)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("on a correct pick, holds the verdict with nothing printed yet (no flicker pop)", () => {
    render(<Harness initial={stateAt("queue-realworld")} />)
    clickCorrect()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
    // reduced motion: the front document rests at the intake shown correct, not
    // fed in, so the output tray is still empty
    expect(
      screen.getByTestId("printer-output").querySelectorAll("[data-cell]"),
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

describe("S&Q stage: teach end-markers (subtle, teach-only)", () => {
  it("stack teach marks the TOP opening and highlights 'top' in the prose", () => {
    render(<Harness initial={stateAt("stack-teach")} />)
    expect(screen.getByTestId("end-marker-top")).toBeInTheDocument()
    expect(screen.queryByTestId("end-marker-front")).toBeNull()
    expect(screen.queryByTestId("end-marker-back")).toBeNull()
    // the vocabulary word is highlighted so prose and figure reinforce each other
    expect(screen.getByText("top")).toBeInTheDocument()
  })

  it("queue teach marks the FRONT and BACK ends and highlights both words", () => {
    render(<Harness initial={stateAt("queue-teach")} />)
    expect(screen.getByTestId("end-marker-front")).toBeInTheDocument()
    expect(screen.getByTestId("end-marker-back")).toBeInTheDocument()
    expect(screen.queryByTestId("end-marker-top")).toBeNull()
    expect(screen.getByText("front")).toBeInTheDocument()
    expect(screen.getByText("back")).toBeInTheDocument()
  })

  it("never renders end-markers in a predict beat (labeling the exit would leak the answer)", () => {
    render(<Harness initial={stateAt("stack-predict")} />)
    expect(screen.queryByTestId("end-marker-top")).toBeNull()
    expect(screen.queryByTestId("end-marker-front")).toBeNull()
    expect(screen.queryByTestId("end-marker-back")).toBeNull()
  })

  it("never renders end-markers in the free-play demo", () => {
    render(<Harness initial={stateAt("stack-demo")} />)
    expect(screen.queryByTestId("end-marker-top")).toBeNull()
    expect(screen.queryByTestId("end-marker-front")).toBeNull()
    expect(screen.queryByTestId("end-marker-back")).toBeNull()
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

describe("S&Q stage: construct take-back (tap the open-end cell)", () => {
  const CASES = [
    {
      part: "stack-construct" as const,
      end: "the top of the stack",
      hint: "Tap the top card to take it back",
    },
    {
      part: "queue-construct" as const,
      end: "the back of the queue",
      hint: "Tap the back card to take it back",
    },
  ]

  for (const { part, end, hint } of CASES) {
    /** Push the first two loose cells, returning the seeded state and their ids. */
    const pushTwo = (): { state: SQState; first: string; second: string } => {
      const base = stateAt(part)
      const [first, second] = base.construct!.loose
      const state = apply(
        base,
        { type: "rewire", from: first, to: "mouth" },
        { type: "rewire", from: second, to: "mouth" },
      )
      return { state, first, second }
    }

    it(`${part}: only the open-end cell is interactive; buried cells are disabled`, () => {
      const { state, first, second } = pushTwo()
      render(<Harness initial={state} />)

      // a hint invites taking the open-end card back, like the drag hint
      expect(screen.getByText(hint)).toBeInTheDocument()

      // the last-pushed (open-end) cell is removable, with a descriptive name
      const removable = screen.getByRole("button", { name: `Remove ${second} from ${end}` })
      expect(removable).toBeEnabled()

      // the buried cell stays a non-interactive pushed cell
      const buried = document.querySelector(`[data-cell="${first}"]`) as HTMLButtonElement
      expect(buried).toBeDisabled()
    })

    it(`${part}: tapping the open-end cell returns it to the loose tray`, () => {
      const { state, second } = pushTwo()
      render(<Harness initial={state} />)

      // before the tap it is a pushed cell, not a loose draggable card
      expect(document.querySelector(`[data-construct-card="${second}"]`)).toBeNull()

      fireEvent.click(screen.getByRole("button", { name: `Remove ${second} from ${end}` }))

      // the cell is back in the loose tray, ready to be added again
      expect(document.querySelector(`[data-construct-card="${second}"]`)).not.toBeNull()
    })
  }
})
