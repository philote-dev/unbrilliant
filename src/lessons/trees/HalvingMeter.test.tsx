import { describe, it, expect, beforeAll } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { HalvingMeter } from "./HalvingMeter"

/**
 * The wordless search-space meter: `total` pips with the discarded candidates
 * extinguished, plus a live "n in play" count. It is decorative (aria-hidden);
 * the figure's role="status" carries the meaning, so these tests assert the pip
 * accounting, the count, and the reduced-motion snap.
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

const on = (els: HTMLElement[]) => els.filter((e) => e.getAttribute("data-on") === "1")

describe("HalvingMeter", () => {
  it("renders `total` pips with (total - remaining) extinguished and a live count", () => {
    render(<HalvingMeter total={7} remaining={3} />)
    const meter = screen.getByTestId("halving-meter")
    const pips = within(meter).getAllByTestId("halving-pip")
    expect(pips).toHaveLength(7)
    expect(on(pips)).toHaveLength(3) // 3 in play
    expect(pips.length - on(pips).length).toBe(4) // 4 extinguished
    expect(meter).toHaveTextContent("3 in play")
  })

  it("halves cleanly 7 -> 3 -> 1 as candidates drop", () => {
    const { rerender } = render(<HalvingMeter total={7} remaining={7} />)
    expect(on(screen.getAllByTestId("halving-pip"))).toHaveLength(7)
    rerender(<HalvingMeter total={7} remaining={3} />)
    expect(on(screen.getAllByTestId("halving-pip"))).toHaveLength(3)
    rerender(<HalvingMeter total={7} remaining={1} />)
    expect(on(screen.getAllByTestId("halving-pip"))).toHaveLength(1)
    expect(screen.getByTestId("halving-meter")).toHaveTextContent("1 in play")
  })

  it("clamps remaining into [0, total]", () => {
    const { rerender } = render(<HalvingMeter total={3} remaining={9} />)
    expect(on(screen.getAllByTestId("halving-pip"))).toHaveLength(3)
    expect(screen.getByTestId("halving-meter")).toHaveTextContent("3 in play")
    rerender(<HalvingMeter total={3} remaining={-2} />)
    expect(on(screen.getAllByTestId("halving-pip"))).toHaveLength(0)
    expect(screen.getByTestId("halving-meter")).toHaveTextContent("0 in play")
  })

  it("is decorative: the meter is aria-hidden (meaning lives in the figure status)", () => {
    render(<HalvingMeter total={7} remaining={7} />)
    expect(screen.getByTestId("halving-meter")).toHaveAttribute("aria-hidden")
  })

  it("snaps for reduced motion", () => {
    render(<HalvingMeter total={7} remaining={3} reducedMotion />)
    expect(screen.getByTestId("halving-meter")).toHaveAttribute("data-reduced-motion", "1")
  })
})
