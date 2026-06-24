import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import { ERTriageBoard } from "./ERTriageBoard"

/**
 * The ER triage skin is a presentational re-dress of the dual tree+array figure.
 * jsdom can't measure geometry, so these cover the sync contract it shares with
 * HeapDualView: one card + one board cell per slot, index-synced highlight/lift
 * across BOTH panels, the reduced-motion snap, and a non-leaking SR label.
 */

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
})

// A valid max-heap with distinct keys (distinct severities -> distinct patients).
const HEAP = [95, 90, 80, 60, 50]

const cards = () => screen.getAllByTestId("triage-card")
const cells = () => screen.getAllByTestId("triage-cell")

describe("ERTriageBoard (ER triage skin)", () => {
  it("renders one patient card and one board cell per slot (the board IS the array)", () => {
    render(<ERTriageBoard heap={HEAP} />)
    expect(cards()).toHaveLength(HEAP.length)
    expect(cells()).toHaveLength(HEAP.length)
  })

  it("tags the root as the most urgent patient", () => {
    render(<ERTriageBoard heap={HEAP} />)
    expect(screen.getByText("Most urgent")).toBeInTheDocument()
  })

  it("lights BOTH the card and the board cell at each highlighted slot (index-synced)", () => {
    render(<ERTriageBoard heap={HEAP} highlightSlots={[1, 3]} />)
    const litCards = cards().filter((c) => c.getAttribute("data-lit") === "1")
    const litCells = cells().filter((c) => c.getAttribute("data-lit") === "1")
    expect(litCards.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["1", "3"])
    expect(litCells.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["1", "3"])
  })

  it("lifts BOTH the card and the board cell of a swap pair together", () => {
    render(<ERTriageBoard heap={HEAP} liftPair={{ a: 0, b: 2 }} />)
    const liftedCards = cards().filter((c) => c.getAttribute("data-lifted") === "1")
    const liftedCells = cells().filter((c) => c.getAttribute("data-lifted") === "1")
    expect(liftedCards.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["0", "2"])
    expect(liftedCells.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["0", "2"])
  })

  it("snaps under reduced motion (no lift animation)", () => {
    render(<ERTriageBoard heap={HEAP} reducedMotion liftPair={{ a: 0, b: 1 }} />)
    expect(screen.getByTestId("er-triage-board")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("voices a screen-reader label that never leaks correctness", () => {
    render(<ERTriageBoard heap={HEAP} srLabel="The board, top to bottom, is 95, 90, 80, 60, 50." />)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("The board, top to bottom, is 95, 90, 80, 60, 50.")
    expect(status).not.toHaveTextContent(/correct|answer/i)
  })
})
