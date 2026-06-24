import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { BrowserShowpiece } from "./BrowserShowpiece"
import { pageFor } from "./browserHistory"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"

// Arrival order drives the page catalogue identity; container order is reversed
// for a stack (newest = top = index 0).
const ARRIVAL = ["p1", "p2", "p3", "p4"]
const HISTORY: Cell[] = [
  { id: "p4", label: "Video" },
  { id: "p3", label: "Map" },
  { id: "p2", label: "Recipe" },
  { id: "p1", label: "Search" },
]
const top = pageFor("p4", ARRIVAL)

describe("BrowserShowpiece", () => {
  it("renders a browser window: tab, address bar, and a newest-on-top history", () => {
    render(<BrowserShowpiece cells={HISTORY} arrival={ARRIVAL} />)
    expect(screen.getByTestId("browser-showpiece")).toBeInTheDocument()
    const history = screen.getByTestId("browser-history")
    expect(history.querySelectorAll("[data-cell]")).toHaveLength(4)
    // the address bar reads the current (top) page's url
    expect(within(screen.getByTestId("browser-address")).getByText(top.url)).toBeInTheDocument()
    // the first history row is the current page (top of the stack)
    const firstRow = history.querySelector("[data-cell]") as HTMLElement
    expect(firstRow).toHaveAttribute("data-cell", "p4")
  })

  it("marks only the page that leaves the top with the dev data-answer hook", () => {
    render(<BrowserShowpiece cells={HISTORY} arrival={ARRIVAL} answerId="p4" selectable />)
    const marked = screen
      .getByTestId("browser-history")
      .querySelectorAll('[data-answer="1"]')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveAttribute("data-cell", "p4")
  })

  it("does not leak the verdict before the replay (no status region)", () => {
    render(<BrowserShowpiece cells={HISTORY} arrival={ARRIVAL} answerId="p4" selectable />)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("commits a page by tap (keyboard + tap parity via the row button)", () => {
    const onSelectCell = vi.fn()
    render(
      <BrowserShowpiece
        cells={HISTORY}
        arrival={ARRIVAL}
        selectable
        onSelectCell={onSelectCell}
      />,
    )
    const row = screen.getByTestId("browser-history").querySelector('[data-cell="p4"]') as HTMLElement
    fireEvent.click(row)
    expect(onSelectCell).toHaveBeenCalledWith("p4")
  })

  it("gives each row an accessible name; the top row says you are on it", () => {
    render(<BrowserShowpiece cells={HISTORY} arrival={ARRIVAL} selectable />)
    const row = screen.getByTestId("browser-history").querySelector('[data-cell="p4"]') as HTMLElement
    expect(row.getAttribute("aria-label")).toContain(top.title)
    expect(row.getAttribute("aria-label")).toContain("the page you are on now")
  })

  it("on Back (popping), the top page leaves history and lands in Forward", () => {
    render(
      <BrowserShowpiece cells={HISTORY} arrival={ARRIVAL} answerId="p4" popping reducedMotion />,
    )
    const history = screen.getByTestId("browser-history")
    // the page that left is gone from history and the rest reflow up
    expect(history.querySelector('[data-cell="p4"]')).toBeNull()
    expect(history.querySelectorAll("[data-cell]")).toHaveLength(3)
    // it appears in the Forward / redo stack
    const forward = screen.getByTestId("browser-forward")
    expect(forward.querySelector('[data-cell="p4"]')).not.toBeNull()
  })

  it("snaps for reduced motion", () => {
    render(<BrowserShowpiece cells={HISTORY} arrival={ARRIVAL} reducedMotion />)
    expect(screen.getByTestId("browser-showpiece")).toHaveAttribute("data-reduced-motion", "1")
  })
})
