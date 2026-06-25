import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import type { LessonAction, QuestionCopy } from "@/features/lesson/engine"
import { T_BAL, T_STICK } from "@/features/lesson/treesEngine"
import { ArenaFooter, ArenaShell, RebalanceBracket } from "./Arena"

/**
 * The tournament-bracket arena chrome. The shell + rebalance flourish are
 * presentational; the footer re-implements the shared verdict machine, so these
 * assert that its button names and dispatched actions match the tracer's
 * expectations (Check / Continue / Why? / Reattempt) and the reduced-motion snap.
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

const COPY: QuestionCopy = {
  prompt: "Find the 6 seed.",
  hint: "Compare at each matchup.",
  nudge: "Advance toward the seed.",
  correct: "Found it in three rounds.",
  why: "A bracket search is a BST descend.",
}

describe("ArenaShell", () => {
  it("renders the eyebrow, title, and footer inside the full-bleed arena", () => {
    render(
      <ArenaShell eyebrow="Bracket search" title="Find the 6 seed." footer={<div>FOOTER</div>}>
        <div>FIGURE</div>
      </ArenaShell>,
    )
    expect(screen.getByTestId("bracket-arena")).toBeInTheDocument()
    expect(screen.getByText("Bracket search")).toBeInTheDocument()
    expect(screen.getByText("Find the 6 seed.")).toBeInTheDocument()
    expect(screen.getByText("FIGURE")).toBeInTheDocument()
    expect(screen.getByText("FOOTER")).toBeInTheDocument()
  })

  it("snaps under reduced motion", () => {
    render(
      <ArenaShell eyebrow="x" title="y" footer={null} reducedMotion>
        <div />
      </ArenaShell>,
    )
    expect(screen.getByTestId("bracket-arena")).toHaveAttribute("data-reduced-motion", "1")
  })
})

describe("ArenaFooter (verdict machine, tracer-compatible)", () => {
  it("idle: gates Check behind canCheck and dispatches check", () => {
    const dispatch = vi.fn()
    const { rerender } = render(
      <ArenaFooter feedback="idle" showWhy={false} canCheck={false} copy={COPY} dispatch={dispatch} />,
    )
    const check = screen.getByRole("button", { name: "Check" })
    expect(check).toBeDisabled()
    rerender(
      <ArenaFooter feedback="idle" showWhy={false} canCheck copy={COPY} dispatch={dispatch} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    expect(dispatch).toHaveBeenCalledWith({ type: "check" })
  })

  it("correct: shows Continue and dispatches next", () => {
    const dispatch = vi.fn()
    render(
      <ArenaFooter feedback="correct" showWhy={false} canCheck copy={COPY} dispatch={dispatch} />,
    )
    expect(screen.getByText("Found it in three rounds.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(dispatch).toHaveBeenCalledWith({ type: "next" })
  })

  it("fail: Why reveals and Reattempt restarts; the answer is SR-only until Why", () => {
    const dispatch = vi.fn()
    const { rerender } = render(
      <ArenaFooter feedback="fail" showWhy={false} canCheck copy={COPY} dispatch={dispatch} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Why?" }))
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal" })
    fireEvent.click(screen.getByRole("button", { name: "Reattempt" }))
    expect(dispatch).toHaveBeenCalledWith({ type: "reattempt" })

    rerender(
      <ArenaFooter feedback="fail" showWhy canCheck copy={COPY} dispatch={dispatch} />,
    )
    expect(screen.getByText("A bracket search is a BST descend.")).toBeInTheDocument()
  })
})

describe("RebalanceBracket", () => {
  it("renders every seed and snaps to balanced under reduced motion", () => {
    render(<RebalanceBracket balanced={T_BAL} stick={T_STICK} reducedMotion />)
    expect(screen.getByTestId("rebalance-bracket")).toBeInTheDocument()
    // all seven seeds present
    for (const k of [2, 4, 6, 8, 10, 12, 14]) {
      expect(screen.getByText(String(k))).toBeInTheDocument()
    }
    expect(screen.getByText(/Rebalanced/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Replay/ })).toBeInTheDocument()
  })
})
