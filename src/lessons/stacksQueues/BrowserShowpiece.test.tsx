import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { BrowserShowpiece } from "./BrowserShowpiece"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"

// Container order: index 0 = the current page (top of history).
const HISTORY: Cell[] = [
  { id: "p3", label: "Photos" },
  { id: "p2", label: "Blog" },
  { id: "p1", label: "Home" },
]

describe("BrowserShowpiece", () => {
  it("wraps the graded history stack and shows the current page in chrome", () => {
    render(<BrowserShowpiece cells={HISTORY} />)
    expect(screen.getByTestId("browser-showpiece")).toBeInTheDocument()
    const history = screen.getByTestId("browser-history")
    expect(history.querySelectorAll("[data-cell]")).toHaveLength(3)
    // the address bar reads the current (top) page
    expect(within(screen.getByTestId("browser-address")).getByText("Photos")).toBeInTheDocument()
  })

  it("medium tier adds a presentational forward stack; minimal omits it", () => {
    const { rerender } = render(<BrowserShowpiece cells={HISTORY} />)
    expect(screen.getByTestId("browser-forward")).toBeInTheDocument()
    expect(
      screen.getByTestId("browser-forward").querySelectorAll("[data-cell]"),
    ).toHaveLength(0)

    rerender(<BrowserShowpiece cells={HISTORY} tier="minimal" />)
    expect(screen.queryByTestId("browser-forward")).toBeNull()
  })

  it("forward stack repopulates with the page the Back replay pops", () => {
    render(<BrowserShowpiece cells={HISTORY} leavingId="p3" />)
    const forward = screen.getByTestId("browser-forward")
    expect(forward.querySelector('[data-cell="p3"]')).not.toBeNull()
  })

  it("exposes the dev data-answer hook on the page you leave (graded surface)", () => {
    render(<BrowserShowpiece cells={HISTORY} answerId="p3" selectable />)
    const marked = screen
      .getByTestId("browser-history")
      .querySelectorAll('[data-answer="1"]')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveAttribute("data-cell", "p3")
  })

  it("commits a page by tap (keyboard + tap parity via the cell button)", () => {
    const onSelectCell = vi.fn()
    render(<BrowserShowpiece cells={HISTORY} selectable onSelectCell={onSelectCell} />)
    const cell = within(screen.getByTestId("browser-history")).getByText("Photos")
    fireEvent.click(cell)
    expect(onSelectCell).toHaveBeenCalledWith("p3")
  })

  it("snaps for reduced motion", () => {
    render(<BrowserShowpiece cells={HISTORY} reducedMotion />)
    expect(screen.getByTestId("browser-showpiece")).toHaveAttribute(
      "data-reduced-motion",
      "1",
    )
  })
})
