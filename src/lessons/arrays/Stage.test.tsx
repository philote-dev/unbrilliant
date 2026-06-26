import { useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

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

describe("Arrays stage: scan walk (reveal cell by cell, no shortcut)", () => {
  it("hides letters, reveals on tap with an anchor, gates the frontier, and solves at the target", () => {
    const init = at("scan")
    const q = init.question!
    const target = q.answerIndex! // makeScan curates this into 2..n-1
    render(<Harness initial={init} />)

    // letters start hidden: the searched value is nowhere on screen yet, and no
    // anchor marks a started search.
    expect(screen.queryByText(q.value!, { exact: true })).toBeNull()
    expect(screen.queryByText(q.cells[0], { exact: true })).toBeNull()
    expect(screen.queryByTestId("scan-anchor")).toBeNull()

    // tap any cell to start: it reveals its letter and drops the search anchor.
    fireEvent.click(screen.getByRole("button", { name: "Reveal cell 0" }))
    expect(screen.getByText(q.cells[0], { exact: true })).toBeInTheDocument()
    expect(screen.getByTestId("scan-anchor")).toBeInTheDocument()

    // only the frontier is tappable: the adjacent cell is, a non-adjacent hidden
    // cell (the target, at index >= 2) is not.
    expect(screen.getByRole("button", { name: "Reveal cell 1" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: `Reveal cell ${target}` })).toBeNull()

    // walk the row one cell at a time until the value turns up.
    for (let i = 1; i <= target; i++) {
      fireEvent.click(screen.getByRole("button", { name: `Reveal cell ${i}` }))
    }

    // reaching the target solves the beat: the value shows, the cost reflects the
    // cells actually checked, and the lesson can continue.
    expect(screen.getByText(q.value!, { exact: true })).toBeInTheDocument()
    expect(screen.getByText(`${target + 1} cells checked`)).toBeInTheDocument()
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

describe("Arrays stage: insert & delete playground (directional, left-anchored)", () => {
  // The row renders by absolute slot, so DOM order matches index order: the
  // logical outcome (new value at index k, prior cells in their original order)
  // is read straight off the rendered cell order.
  const playCells = () => screen.getAllByTestId("play-cell").map((el) => el.textContent)

  it("inserts the new value at the chosen index, keeping the prior cells in order", () => {
    render(<Harness initial={at("play-mutate")} />)
    expect(playCells()).toEqual(["A", "B", "C", "D"])

    // the default insert index is 2: the new value lands at index 2 while the
    // cells before it (A, B) stay put and the tail (C, D) keeps its order.
    fireEvent.click(screen.getByRole("button", { name: "Insert" }))
    expect(playCells()).toEqual(["A", "B", "E", "C", "D"])
  })

  it("inserts at the front when the index is lowered to 0", () => {
    render(<Harness initial={at("play-mutate")} />)
    fireEvent.click(screen.getByRole("button", { name: "Lower the insert index" }))
    fireEvent.click(screen.getByRole("button", { name: "Lower the insert index" }))
    fireEvent.click(screen.getByRole("button", { name: "Insert" }))
    expect(playCells()).toEqual(["E", "A", "B", "C", "D"])
  })

  it("deletes the tapped cell and closes the gap, keeping the rest in order", async () => {
    render(<Harness initial={at("play-mutate")} />)
    fireEvent.click(screen.getByRole("button", { name: "Delete value B at index 1" }))
    await waitFor(() => expect(playCells()).toEqual(["A", "C", "D"]))
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
