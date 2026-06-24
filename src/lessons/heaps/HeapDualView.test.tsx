import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { HeapDualView } from "./HeapDualView"

const HEAP = [9, 7, 6, 3, 2]

describe("HeapDualView", () => {
  it("renders one tree node and one array cell per heap slot (same data)", () => {
    render(<HeapDualView heap={HEAP} />)
    expect(screen.getAllByTestId("heap-node")).toHaveLength(HEAP.length)
    expect(screen.getAllByTestId("heap-cell")).toHaveLength(HEAP.length)
    // values render in both panels; the index ruler labels each cell.
    expect(screen.getByLabelText("slot 0, value 9")).toBeInTheDocument()
    expect(screen.getByLabelText("slot 4, value 2")).toBeInTheDocument()
  })

  it("tapping an array cell commits that slot", () => {
    const onTapSlot = vi.fn()
    render(<HeapDualView heap={HEAP} onTapSlot={onTapSlot} correctSlot={1} />)
    fireEvent.click(screen.getByLabelText("slot 1, value 7"))
    expect(onTapSlot).toHaveBeenCalledWith(1)
  })

  it("draws the 2i+1 / 2i+2 / (i-1)/2 connectors for the subject slot, in the array panel", () => {
    // slot 0: two children (1, 2), no parent → 2 connectors.
    const root = render(<HeapDualView heap={HEAP} connectorSlot={0} />)
    expect(screen.getAllByTestId("heap-connector")).toHaveLength(2)
    root.unmount()

    // slot 1: two children (3, 4) + a parent (0) → 3 connectors.
    render(<HeapDualView heap={HEAP} connectorSlot={1} />)
    expect(screen.getAllByTestId("heap-connector")).toHaveLength(3)
  })

  it("renders no connectors when no slot is active", () => {
    render(<HeapDualView heap={HEAP} />)
    expect(screen.queryAllByTestId("heap-connector")).toHaveLength(0)
  })

  it("exposes a DEV-only correct-slot hook on the winning cell", () => {
    render(<HeapDualView heap={HEAP} onTapSlot={() => {}} correctSlot={1} />)
    expect(screen.getByLabelText("slot 1, value 7")).toHaveAttribute(
      "data-heap-correct-slot",
      "1",
    )
    expect(screen.getByLabelText("slot 0, value 9")).not.toHaveAttribute("data-heap-correct-slot")
  })

  it("snaps for reduced motion (no lift/draw animation)", () => {
    render(<HeapDualView heap={HEAP} reducedMotion liftPair={{ a: 0, b: 1 }} />)
    expect(screen.getByTestId("heap-dual-view")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("announces a screen-reader label when provided", () => {
    render(<HeapDualView heap={HEAP} srLabel="9 is on top; slot 1's parent is slot 0." />)
    expect(screen.getByRole("status")).toHaveTextContent("9 is on top")
  })

  it("highlightSlots lights BOTH the tree node and the array cell at each slot (synced)", () => {
    render(<HeapDualView heap={HEAP} highlightSlots={[1, 3]} />)
    const litNodes = screen
      .getAllByTestId("heap-node")
      .filter((n) => n.getAttribute("data-lit") === "1")
    const litCells = screen
      .getAllByTestId("heap-cell")
      .filter((c) => c.getAttribute("data-lit") === "1")
    expect(litNodes.map((n) => n.getAttribute("data-slot")).sort()).toEqual(["1", "3"])
    expect(litCells.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["1", "3"])
  })

  it("overlays a verdict icon on selected / correct / fail cells (never colour alone)", () => {
    const { rerender } = render(
      <HeapDualView heap={HEAP} selectedSlot={2} selectedTone="selected" />,
    )
    // the learner's selected cell carries a (non-colour) badge...
    expect(
      within(screen.getByLabelText("slot 2, value 6")).getByTestId("heap-cell-icon"),
    ).toBeInTheDocument()
    // ...and an unselected, unlit cell does not.
    expect(
      within(screen.getByLabelText("slot 0, value 9")).queryByTestId("heap-cell-icon"),
    ).toBeNull()

    // a revealed-correct cell shows the check badge.
    rerender(<HeapDualView heap={HEAP} revealSlot={1} />)
    expect(
      within(screen.getByLabelText("slot 1, value 7")).getByTestId("heap-cell-icon"),
    ).toBeInTheDocument()

    // a failed pick shows a badge too (icon + the figure's tone, not tone alone).
    rerender(<HeapDualView heap={HEAP} selectedSlot={3} selectedTone="fail" />)
    expect(
      within(screen.getByLabelText("slot 3, value 3")).getByTestId("heap-cell-icon"),
    ).toBeInTheDocument()
  })

  it("liftPair lifts BOTH nodes and BOTH cells together, snapping under reduced motion", () => {
    const lifted = () => ({
      nodes: screen
        .getAllByTestId("heap-node")
        .filter((n) => n.getAttribute("data-lifted") === "1")
        .map((n) => n.getAttribute("data-slot"))
        .sort(),
      cells: screen
        .getAllByTestId("heap-cell")
        .filter((c) => c.getAttribute("data-lifted") === "1")
        .map((c) => c.getAttribute("data-slot"))
        .sort(),
    })

    const { rerender } = render(<HeapDualView heap={HEAP} liftPair={{ a: 0, b: 1 }} />)
    expect(lifted().nodes).toEqual(["0", "1"])
    expect(lifted().cells).toEqual(["0", "1"])

    // Reduced motion: still the same pair on both panels, just snapped (no animation).
    rerender(<HeapDualView heap={HEAP} liftPair={{ a: 0, b: 1 }} reducedMotion />)
    expect(lifted().nodes).toEqual(["0", "1"])
    expect(lifted().cells).toEqual(["0", "1"])
    expect(screen.getByTestId("heap-dual-view")).toHaveAttribute("data-reduced-motion", "1")
  })
})
