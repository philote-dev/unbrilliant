import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"
import { render, fireEvent } from "@testing-library/react"

import type { LessonAction } from "@/features/lesson/engine"
import { resumeTrees, treesReducer, type TreesState } from "@/features/lesson/treesEngine"
import { GuessNumber } from "./GuessNumber"

/**
 * The "guess my number" skin. jsdom can't measure the range-bar geometry, but
 * everything that carries meaning is pure: the band label + verdict chip derive
 * from `subtreeKeyRange` / the cursor, the guess buttons dispatch the same
 * `select(childId)` a node tap would (with the dev-only `data-answer` on the
 * correct one), and the skin never dispatches `check`. These cover that contract.
 */

function setReducedMotion(matches: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

beforeAll(() => setReducedMotion(false))
afterEach(() => setReducedMotion(false))

const run = (s: TreesState, ...actions: LessonAction[]) => actions.reduce(treesReducer, s)

/** The real-world beat at the root (cursor n8), seeded deterministically. */
const realworld = (): TreesState =>
  resumeTrees({ counters: {}, currentPart: "realworld", completed: false }, 1)

describe("GuessNumber: band (the work-meter)", () => {
  it("labels the band with the cursor subtree's key range and halves each guess", () => {
    let s = realworld()
    const { getByTestId, rerender } = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    // root n8: the whole tree is in play.
    expect(getByTestId("guess-band-label")).toHaveTextContent("between 2 and 14")

    s = run(s, { type: "select", letter: "n4" }) // guess lower
    rerender(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(getByTestId("guess-band-label")).toHaveTextContent("between 2 and 6")

    s = run(s, { type: "select", letter: "n6" }) // guess higher → the secret
    rerender(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(getByTestId("guess-band-label")).toHaveTextContent("between 6 and 6")
  })
})

describe("GuessNumber: verdict chip", () => {
  it("reads the host's reply to the latest guess (lower → higher → got-it)", () => {
    let s = realworld()
    const { getByTestId, rerender } = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(getByTestId("guess-verdict")).toHaveAttribute("data-verdict", "lower")
    expect(getByTestId("guess-verdict")).toHaveTextContent("Lower!")

    s = run(s, { type: "select", letter: "n4" })
    rerender(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(getByTestId("guess-verdict")).toHaveAttribute("data-verdict", "higher")
    expect(getByTestId("guess-verdict")).toHaveTextContent("Higher!")

    s = run(s, { type: "select", letter: "n6" })
    rerender(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(getByTestId("guess-verdict")).toHaveAttribute("data-verdict", "got-it")
    expect(getByTestId("guess-verdict")).toHaveTextContent("Got it!")
  })

  it("celebrates only once the verdict is confirmed correct", () => {
    let s = run(realworld(), { type: "select", letter: "n4" }, { type: "select", letter: "n6" })
    // On the target but not yet checked: got-it chip, but no celebration and no win copy.
    const pre = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(pre.getByTestId("guess-verdict")).toHaveAttribute("data-verdict", "got-it")
    expect(pre.getByTestId("guess-verdict")).not.toHaveAttribute("data-celebrate")
    expect(pre.getByTestId("guess-band-label")).toHaveTextContent("between 6 and 6")
    pre.unmount()

    s = run(s, { type: "check" })
    expect(s.feedback).toBe("correct")
    const won = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(won.getByTestId("guess-verdict")).toHaveAttribute("data-celebrate", "1")
    expect(won.getByTestId("guess-band-label")).toHaveTextContent("It's 6")
  })

  it("does not celebrate under reduced motion, even when correct", () => {
    let s = run(realworld(), { type: "select", letter: "n4" }, { type: "select", letter: "n6" })
    s = run(s, { type: "check" })
    const { getByTestId } = render(<GuessNumber state={s} dispatch={vi.fn()} reducedMotion />)
    expect(getByTestId("guess-verdict")).not.toHaveAttribute("data-celebrate")
  })
})

describe("GuessNumber: guess buttons", () => {
  it("renders the cursor's two children as lower / higher guesses", () => {
    const { container } = render(<GuessNumber state={realworld()} dispatch={vi.fn()} />)
    const lower = container.querySelector('[data-guess-side="left"]')
    const higher = container.querySelector('[data-guess-side="right"]')
    expect(lower).toHaveTextContent("4") // left child of 8
    expect(higher).toHaveTextContent("12") // right child of 8
  })

  it("dispatches select(childId) exactly as a node tap would", () => {
    const dispatch = vi.fn()
    const { container } = render(<GuessNumber state={realworld()} dispatch={dispatch} />)
    fireEvent.click(container.querySelector('[data-guess-side="left"]')!)
    expect(dispatch).toHaveBeenCalledWith({ type: "select", letter: "n4" })
    fireEvent.click(container.querySelector('[data-guess-side="right"]')!)
    expect(dispatch).toHaveBeenCalledWith({ type: "select", letter: "n12" })
  })

  it("keeps the dev-only data-answer on the correct guess (tracer unchanged)", () => {
    let s = realworld()
    const first = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    // secret 6 < 8 → the correct guess is lower (n4).
    expect(first.container.querySelector('[data-guess-side="left"]')).toHaveAttribute("data-answer", "1")
    expect(first.container.querySelector('[data-guess-side="right"]')).not.toHaveAttribute("data-answer")
    first.unmount()

    // after guessing lower, 6 > 4 → the correct guess flips to higher (n6).
    s = run(s, { type: "select", letter: "n4" })
    const second = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(second.container.querySelector('[data-guess-side="right"]')).toHaveAttribute("data-answer", "1")
    expect(second.container.querySelector('[data-guess-side="left"]')).not.toHaveAttribute("data-answer")
  })

  it("hides the guess buttons once the secret is reached", () => {
    const s = run(realworld(), { type: "select", letter: "n4" }, { type: "select", letter: "n6" })
    const { container } = render(<GuessNumber state={s} dispatch={vi.fn()} />)
    expect(container.querySelectorAll("[data-guess-side]")).toHaveLength(0)
  })

  it("never dispatches check, only select (Check lives in the footer)", () => {
    const dispatch = vi.fn()
    const { container } = render(<GuessNumber state={realworld()} dispatch={dispatch} />)
    for (const btn of container.querySelectorAll("[data-guess-side]")) fireEvent.click(btn)
    expect(dispatch).toHaveBeenCalled()
    expect(dispatch.mock.calls.every(([a]: [LessonAction]) => a.type === "select")).toBe(true)
  })
})

describe("GuessNumber: a11y", () => {
  it("announces the latest guess, the reply, and the live range via role=status", () => {
    const { container } = render(<GuessNumber state={realworld()} dispatch={vi.fn()} />)
    expect(container.querySelector('[role="status"]')).toHaveTextContent(
      "You guessed 8. Lower. The secret is between 2 and 14.",
    )
  })

  it("snaps under reduced motion", () => {
    const { getByTestId } = render(<GuessNumber state={realworld()} dispatch={vi.fn()} reducedMotion />)
    expect(getByTestId("guess-number")).toHaveAttribute("data-reduced-motion", "1")
  })
})
