import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, beforeAll, vi } from "vitest"

import { ERTriageBoard } from "./ERTriageBoard"

/**
 * The ER triage skin is a presentational re-dress of the dual tree+array figure.
 * jsdom can't measure geometry, so these cover the sync contract it shares with
 * HeapDualView: one card + one board cell per slot, index-synced highlight/lift
 * across BOTH panels, the value-keyed traveling-node treatment, the do-the-sift
 * interaction (tap a patient / cell), the reduced-motion snap, and a non-leaking
 * SR label.
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

  it("travels each patient (card + cell) to its new slot, keeping its value identity", () => {
    // Each card/cell is keyed by VALUE, so a swap carries the patient to the new
    // address in BOTH panels rather than re-labelling the slot in place.
    const cellByValue = (v: number) => cells().find((c) => c.getAttribute("data-value") === String(v))
    const cardByValue = (v: number) => cards().find((c) => c.getAttribute("data-value") === String(v))
    const { rerender } = render(<ERTriageBoard heap={HEAP} />)
    expect(cellByValue(95)).toHaveAttribute("data-slot", "0")
    expect(cardByValue(95)).toHaveAttribute("data-slot", "0")

    // 95 and 90 trade slots: the SAME patient lands at the new address in both panels.
    rerender(<ERTriageBoard heap={[90, 95, 80, 60, 50]} />)
    expect(cellByValue(95)).toHaveAttribute("data-slot", "1")
    expect(cardByValue(95)).toHaveAttribute("data-slot", "1")
    expect(cellByValue(90)).toHaveAttribute("data-slot", "0")
  })

  it("snaps a swap to the final arrangement under reduced motion (no travel)", () => {
    const cellByValue = (v: number) => cells().find((c) => c.getAttribute("data-value") === String(v))
    const { rerender } = render(<ERTriageBoard heap={HEAP} reducedMotion />)
    rerender(<ERTriageBoard heap={[90, 95, 80, 60, 50]} reducedMotion />)
    expect(cellByValue(95)).toHaveAttribute("data-slot", "1")
    expect(screen.getByTestId("er-triage-board")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("commits a slot when its intake cell or patient card is tapped (do-the-sift)", () => {
    const onTapSlot = vi.fn()
    const onTapNode = vi.fn()
    const { rerender } = render(<ERTriageBoard heap={HEAP} onTapSlot={onTapSlot} />)
    fireEvent.click(screen.getByLabelText("slot 2, value 80"))
    expect(onTapSlot).toHaveBeenCalledWith(2)

    rerender(<ERTriageBoard heap={HEAP} onTapNode={onTapNode} />)
    const card80 = cards().find((c) => c.getAttribute("data-value") === "80")!
    fireEvent.click(card80)
    expect(onTapNode).toHaveBeenCalledWith(2)
  })

  it("intake cells are inert (no labels, disabled) when not interactive", () => {
    render(<ERTriageBoard heap={HEAP} />)
    expect(screen.queryByLabelText(/slot 0, value/)).toBeNull()
    cells().forEach((c) => expect(c).toBeDisabled())
  })

  it("exposes the next-swap DEV hooks on the two cells of the proposed move", () => {
    render(<ERTriageBoard heap={HEAP} onTapSlot={() => {}} siftPair={{ a: 0, b: 2 }} />)
    const cellByValue = (v: number) => cells().find((c) => c.getAttribute("data-value") === String(v))
    expect(cellByValue(95)).toHaveAttribute("data-sift-from", "1") // slot 0
    expect(cellByValue(80)).toHaveAttribute("data-sift-to", "1") // slot 2
    expect(cellByValue(90)).not.toHaveAttribute("data-sift-from") // slot 1
  })

  it("lights the held patient (card + cell) with the selected tone, a wrong move nudges", () => {
    const { rerender } = render(
      <ERTriageBoard heap={HEAP} onTapSlot={() => {}} selectedSlot={3} selectedTone="selected" />,
    )
    const cellByValue = (v: number) => cells().find((c) => c.getAttribute("data-value") === String(v))
    const cardByValue = (v: number) => cards().find((c) => c.getAttribute("data-value") === String(v))
    expect(cellByValue(60)).toHaveAttribute("data-lit", "1") // slot 3 holds 60
    expect(cellByValue(60)).toHaveAttribute("data-tone", "selected")
    expect(cardByValue(60)).toHaveAttribute("data-lit", "1")
    expect(within(cellByValue(60)!).getByText("60")).toBeInTheDocument()

    rerender(
      <ERTriageBoard heap={HEAP} onTapSlot={() => {}} selectedSlot={3} selectedTone="nudge" />,
    )
    // The held cell + card both carry the nudge tone (the caution colour is theme
    // aware, so the tone is asserted semantically rather than by a fixed class).
    expect(cellByValue(60)).toHaveAttribute("data-tone", "nudge")
    expect(cardByValue(60)).toHaveAttribute("data-tone", "nudge")
  })

  it("marks a highlighted slot with the lit tone in both panels", () => {
    render(<ERTriageBoard heap={HEAP} highlightSlots={[2]} />)
    const cell = cells().find((c) => c.getAttribute("data-slot") === "2")
    const card = cards().find((c) => c.getAttribute("data-slot") === "2")
    expect(cell).toHaveAttribute("data-tone", "lit")
    expect(card).toHaveAttribute("data-tone", "lit")
  })

  it("renders on the light surface (theme-aware) keeping the same sync contract", () => {
    // The light coat is white + red; it must still draw one card + one cell per slot
    // and tag the root, so the board reads in either theme.
    render(<ERTriageBoard heap={HEAP} surface="light" />)
    expect(cards()).toHaveLength(HEAP.length)
    expect(cells()).toHaveLength(HEAP.length)
    expect(screen.getByText("Most urgent")).toBeInTheDocument()
  })

  it("tier mode shows triage categories instead of severity-derived names", () => {
    // Patient names/icons are a pure function of the key, so re-triage (changing a
    // key) would swap a person's identity. Tier mode shows the category instead, so
    // a re-triaged patient simply re-tiers. Here the root (95) is Critical, not the
    // name the severity would otherwise map to.
    render(<ERTriageBoard heap={HEAP} tier />)
    expect(screen.getAllByText(/Critical/).length).toBeGreaterThan(0)
    // "Santos" is the name severity 95 maps to in the named look; tier mode hides it.
    expect(screen.queryByText(/Santos/)).toBeNull()
  })

  it("flags the most-urgent root for the red highlight in both panels", () => {
    render(<ERTriageBoard heap={HEAP} />)
    const rootCard = cards().find((c) => c.getAttribute("data-slot") === "0")
    const rootCell = cells().find((c) => c.getAttribute("data-slot") === "0")
    const childCard = cards().find((c) => c.getAttribute("data-slot") === "2")
    expect(rootCard).toHaveAttribute("data-root", "1")
    expect(rootCell).toHaveAttribute("data-root", "1")
    expect(childCard).not.toHaveAttribute("data-root")
  })

  it("shows a quiet number-context note by default, hideable via scaleNote", () => {
    const { rerender } = render(<ERTriageBoard heap={HEAP} />)
    expect(screen.getByText(/triage severity/i)).toBeInTheDocument()
    rerender(<ERTriageBoard heap={HEAP} scaleNote={false} />)
    expect(screen.queryByText(/triage severity/i)).toBeNull()
  })
})
