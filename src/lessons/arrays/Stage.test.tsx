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
 * DOM tests for the rebuilt Arrays stage. Reduced motion is forced (matchMedia
 * matches) so animations snap to their end-state with no timers. They cover the
 * seams that matter: the de-cued access (no pre-highlight; the jump/scan overlay
 * fires only POST-verdict), the place-cheapest gap drag commits via tap AND
 * keyboard through the shared rewire surface, and the SR-only fail copy.
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
  it("draws no jump overlay until a verdict lands, then reveals it", () => {
    const { container } = render(<Harness initial={at("jump")} />)
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

describe("Arrays stage — place-cheapest commits via tap and keyboard", () => {
  it("dropping the cell on the end gap (tap) clears the beat", () => {
    const init = at("place-cheapest")
    const n = init.question!.cells.length
    render(<Harness initial={init} />)

    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled()
    fireEvent.click(screen.getByLabelText("cell X")) // arm the loose cell
    fireEvent.click(screen.getByLabelText(new RegExp(`the gap at index ${n}\\b`))) // drop on the end
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("keyboard parity: arm the cell and cycle to the end gap with the keys", () => {
    const init = at("place-cheapest")
    const n = init.question!.cells.length
    render(<Harness initial={init} />)

    const src = screen.getByLabelText("cell X")
    fireEvent.keyDown(src, { key: "Enter" }) // arm
    for (let i = 0; i <= n; i++) fireEvent.keyDown(src, { key: "ArrowRight" }) // hover gap-n
    fireEvent.keyDown(src, { key: "Enter" }) // commit
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("Arrays stage — minimal fail UX (SR-only, no fail sentence)", () => {
  it("hides the fail sentence until Why, keeping the answer withheld", () => {
    const init = at("insert")
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
