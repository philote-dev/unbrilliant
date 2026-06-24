import { describe, it, expect, beforeAll, vi } from "vitest"
import { render, screen } from "@testing-library/react"

/**
 * The parking-lot skin. `useReducedMotion` is mocked to true so every case snaps
 * straight to its end-state with no timers, which keeps these deterministic and
 * lets us assert the snapped arrangement directly. The tests cover the seams that
 * matter for the skin: reduced-motion end-state, accessible 44px bays, the
 * no-leak gate (no wave / no spoken result before the reveal), and that the car
 * skinning is a pure function.
 */
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>()
  return { ...actual, useReducedMotion: () => true }
})

import { ParkingLot, type ParkingScene } from "./ParkingLot"
import { ARRIVAL_LABEL, carFor } from "./parkingData"

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

const shiftScene = (reveal: boolean): ParkingScene => ({
  kind: "shift",
  cars: ["A", "B", "C", "D"],
  op: { kind: "insert", index: 2, inserted: ARRIVAL_LABEL },
  reveal,
  cost: { word: "scales", count: 2, unit: "elements moved" },
})

const bayOf = (label: string) =>
  document.querySelector(`[data-car="${label}"]`)?.getAttribute("data-bay")

describe("ParkingLot — reduced motion snaps to the end-state", () => {
  it("renders the post-insert arrangement directly (no intermediate wave)", () => {
    render(<ParkingLot scene={shiftScene(true)} />)

    // the root advertises the reduced-motion snap…
    expect(screen.getByTestId("parking-lot")).toHaveAttribute("data-reduced-motion", "1")

    // …and the end-state is rendered as-is: insert X at bay 2 pushes C, D right.
    expect(bayOf("A")).toBe("0")
    expect(bayOf("B")).toBe("1")
    expect(bayOf(ARRIVAL_LABEL)).toBe("2")
    expect(bayOf("C")).toBe("3")
    expect(bayOf("D")).toBe("4")

    // the arrival car is flagged for the eye + assistive tech.
    expect(document.querySelector('[data-arrival="1"]')).not.toBeNull()
  })
})

describe("ParkingLot — bays are tappable 44px targets with names", () => {
  it("gives every bay an accessible name and a >= 44px footprint", () => {
    render(
      <ParkingLot
        scene={{
          kind: "access",
          cars: ["A", "B", "C"],
          pinned: null,
          cost: { word: "free", count: 1, unit: "step" },
        }}
      />,
    )

    const bays = screen.getAllByTestId("bay")
    expect(bays).toHaveLength(3)
    for (const bay of bays) {
      expect(bay.getAttribute("aria-label")).toMatch(/^Bay \d+, car [A-Z]/)
      expect(parseInt(bay.style.width, 10)).toBeGreaterThanOrEqual(44)
      expect(parseInt(bay.style.height, 10)).toBeGreaterThanOrEqual(44)
    }
  })
})

describe("ParkingLot — the wave never leaks before the verdict", () => {
  it("shows no arrival car and announces nothing until reveal flips true", () => {
    const { rerender } = render(<ParkingLot scene={shiftScene(false)} />)

    // pre-reveal: the structure is there, but no arrival and no spoken result.
    expect(screen.getAllByTestId("car").length).toBe(4)
    expect(document.querySelector('[data-arrival="1"]')).toBeNull()
    expect(screen.queryByText(/rolled forward/)).toBeNull()

    rerender(<ParkingLot scene={shiftScene(true)} />)

    expect(document.querySelector('[data-arrival="1"]')).not.toBeNull()
    expect(screen.getByText(/2 cars rolled forward\. scales\./)).toBeInTheDocument()
  })
})

describe("ParkingLot — carFor is a pure, deterministic skin", () => {
  it("paints the arrival car for X and is stable for the same input", () => {
    expect(carFor(ARRIVAL_LABEL, ["A", "B"]).arrival).toBe(true)
    expect(carFor("A", ["A", "B"]).arrival).toBe(false)
    expect(carFor("B", ["A", "B", "C"])).toEqual(carFor("B", ["A", "B", "C"]))
  })

  it("colours cars by position, so neighbours differ", () => {
    const a = carFor("A", ["A", "B"])
    const b = carFor("B", ["A", "B"])
    expect(a.body).toHaveLength(2)
    expect(a.body).not.toEqual(b.body)
  })
})
