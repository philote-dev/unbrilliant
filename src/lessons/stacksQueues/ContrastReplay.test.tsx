import { render, screen, within } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { ContrastReplay } from "./ContrastReplay"

const ARRIVAL = ["A", "B", "C"]

describe("ContrastReplay", () => {
  it("renders both a stack and a queue from the same arrival (dual view)", () => {
    render(<ContrastReplay arrival={ARRIVAL} target="C" winner="stack" />)
    const stack = screen.getByTestId("contrast-stack")
    const queue = screen.getByTestId("contrast-queue")
    // de-cued: each container holds all three cells before the replay drains them
    expect(stack.querySelectorAll("[data-cell]")).toHaveLength(3)
    expect(queue.querySelectorAll("[data-cell]")).toHaveLength(3)
    // idle (no replay): no verdict surfaces yet
    expect(screen.queryByTestId("contrast-winner")).toBeNull()
    expect(screen.queryByTestId("contrast-emit-stack")).toBeNull()
  })

  it("on replay, shows each side's emit step with the target highlighted", () => {
    render(<ContrastReplay arrival={ARRIVAL} target="C" winner="stack" replay reducedMotion />)
    expect(screen.getByTestId("contrast-emit-stack")).toHaveTextContent("C left 1st")
    expect(screen.getByTestId("contrast-emit-queue")).toHaveTextContent("C left 3rd")
  })

  it("badges the winner with icon + text and a dev hook", () => {
    render(<ContrastReplay arrival={ARRIVAL} target="C" winner="stack" replay reducedMotion />)
    const badge = screen.getByTestId("contrast-winner")
    expect(badge).toHaveTextContent("The stack hands you C first")
    expect(badge).toHaveAttribute("data-contrast-winner", "stack")
    // an icon rides alongside the text (never colour/text alone)
    expect(badge.querySelector("svg")).not.toBeNull()
  })

  it("announces a screen-reader status label when provided", () => {
    render(
      <ContrastReplay
        arrival={ARRIVAL}
        target="C"
        winner="stack"
        replay
        reducedMotion
        srLabel="Stack hands you C first: 1st vs 3rd"
      />,
    )
    expect(screen.getByRole("status")).toHaveTextContent("Stack hands you C first: 1st vs 3rd")
  })

  it("snaps for reduced motion (drained end-state, no ticking)", () => {
    render(<ContrastReplay arrival={ARRIVAL} target="C" winner="stack" replay reducedMotion />)
    expect(screen.getByTestId("contrast-replay")).toHaveAttribute("data-reduced-motion", "1")
    // fully drained: the bins are empty, the readout carries the result
    expect(within(screen.getByTestId("contrast-stack")).queryByText("C")).toBeNull()
    expect(screen.getByTestId("contrast-emit-stack")).toBeInTheDocument()
  })
})
