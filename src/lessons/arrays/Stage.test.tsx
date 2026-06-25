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
 * DOM tests for the redesigned Arrays stage. Reduced motion is forced (matchMedia
 * matches) so animations snap to their end-state with no timers. They cover the
 * seams that matter: the de-cued access (no pre-highlight; the jump/scan overlay
 * fires only POST-verdict), the A5 construct commits via tap AND keyboard through
 * the shared rewire surface, and the SR-only fail copy (no visible fail sentence).
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

const at = (part: string): ArraysState =>
  resumeArrays({ counters: {}, currentPart: part, completed: false }, SEED)

describe("Arrays stage — de-cued access (overlay is post-verdict only)", () => {
  it("draws no jump/scan overlay until a verdict lands, then reveals it", () => {
    const { container } = render(<Harness initial={at("a1-access")} />)
    // de-cued: the access overlay (the only <path> here) is absent before the verdict
    expect(container.querySelector("svg path")).toBeNull()
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled()

    fireEvent.click(document.querySelector('[data-answer="1"]') as HTMLElement)
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    // correct → the jump arc overlay is drawn and the lesson can continue
    expect(container.querySelector("svg path")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("Arrays stage — A5 construct commits via tap and keyboard", () => {
  it("appending the loose cells in order (tap) clears the beat", () => {
    const init = at("a5-construct")
    const ops = init.question!.correctOps!
    render(<Harness initial={init} />)

    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled()
    for (const id of ops) {
      fireEvent.click(screen.getByLabelText(`cell ${id}`)) // arm the source
      fireEvent.click(screen.getByLabelText(/^the open end of the row/)) // drop on the end
    }
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("keyboard parity: a source can be armed and dropped on the end with the keys", () => {
    const init = at("a5-construct")
    const first = init.question!.correctOps![0]
    render(<Harness initial={init} />)

    const looseBefore = screen.getAllByLabelText(/^cell /).length
    const src = screen.getByLabelText(`cell ${first}`)
    fireEvent.keyDown(src, { key: "Enter" }) // arm
    fireEvent.keyDown(src, { key: "ArrowRight" }) // hover the end target
    fireEvent.keyDown(src, { key: "Enter" }) // commit

    // one loose cell was appended, so there is one fewer source
    expect(screen.getAllByLabelText(/^cell /).length).toBe(looseBefore - 1)
  })
})

describe("Arrays stage — minimal fail UX (SR-only, no fail sentence)", () => {
  it("hides the fail sentence until Why, keeping the answer withheld", () => {
    const init = at("a2-shift")
    render(<Harness initial={init} />)

    const wrongCard = () =>
      Array.from(document.querySelectorAll('[data-testid="answer-card"]')).find(
        (c) => c.getAttribute("data-answer") !== "1",
      ) as HTMLElement
    fireEvent.click(wrongCard())
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    fireEvent.click(wrongCard())
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    // full fail: no visible fail sentence, but Why?/Reattempt carry it
    expect(screen.queryByText(/Not quite/)).toBeNull()
    expect(screen.getByRole("button", { name: "Why?" })).toBeInTheDocument()
    expect(screen.queryByText(init.question!.why)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Why?" }))
    expect(screen.getByText(init.question!.why)).toBeInTheDocument()
  })
})
