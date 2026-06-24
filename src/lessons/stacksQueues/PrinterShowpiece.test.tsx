import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { PrinterShowpiece } from "./PrinterShowpiece"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"

// Container order: index 0 = the front (the next file to print).
const JOBS: Cell[] = [
  { id: "j1", label: "report" },
  { id: "j2", label: "essay" },
  { id: "j3", label: "photo" },
]

describe("PrinterShowpiece", () => {
  it("wraps the graded queue with every job in arrival order", () => {
    render(<PrinterShowpiece cells={JOBS} />)
    expect(screen.getByTestId("printer-showpiece")).toBeInTheDocument()
    expect(
      screen.getByTestId("printer-showpiece").querySelectorAll("[data-cell]"),
    ).toHaveLength(3)
  })

  it("medium tier marks the FRONT job as 'Now printing'; minimal omits it", () => {
    const { rerender } = render(<PrinterShowpiece cells={JOBS} />)
    const indicator = screen.getByTestId("printer-now-printing")
    expect(indicator).toHaveTextContent("Now printing")
    expect(indicator).toHaveTextContent("report") // the front, never a later job

    rerender(<PrinterShowpiece cells={JOBS} tier="minimal" />)
    expect(screen.queryByTestId("printer-now-printing")).toBeNull()
  })

  it("offers no cancel control, keeping the queue a pure FIFO", () => {
    render(<PrinterShowpiece cells={JOBS} />)
    expect(screen.queryByText(/cancel/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull()
  })

  it("exposes the dev data-answer hook on the winning job (graded surface)", () => {
    render(<PrinterShowpiece cells={JOBS} answerId="j1" selectable />)
    const marked = screen
      .getByTestId("printer-showpiece")
      .querySelectorAll('[data-answer="1"]')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveAttribute("data-cell", "j1")
  })

  it("commits a job by tap (keyboard + tap parity via the cell button)", () => {
    const onSelectCell = vi.fn()
    render(<PrinterShowpiece cells={JOBS} selectable onSelectCell={onSelectCell} />)
    const cell = screen
      .getByTestId("printer-showpiece")
      .querySelector('[data-cell="j1"]') as HTMLElement
    fireEvent.click(cell)
    expect(onSelectCell).toHaveBeenCalledWith("j1")
  })

  it("snaps for reduced motion", () => {
    render(<PrinterShowpiece cells={JOBS} reducedMotion />)
    expect(screen.getByTestId("printer-showpiece")).toHaveAttribute(
      "data-reduced-motion",
      "1",
    )
  })
})
