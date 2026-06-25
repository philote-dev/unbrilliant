import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { DriveThruLane } from "./DriveThruLane"
import { carFor } from "./driveThruCars"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"

// A queue keeps arrival order, so container order == arrival; index 0 = front.
const ARRIVAL = ["c1", "c2", "c3", "c4"]
const LANE: Cell[] = [
  { id: "c1", label: "Red" },
  { id: "c2", label: "Blue" },
  { id: "c3", label: "Green" },
  { id: "c4", label: "Amber" },
]
const front = carFor("c1", ARRIVAL)

describe("DriveThruLane (primary queue skin)", () => {
  it("renders the lane with every car in arrival order", () => {
    render(<DriveThruLane cells={LANE} arrival={ARRIVAL} />)
    expect(screen.getByTestId("drivethru-lane")).toBeInTheDocument()
    const lane = screen.getByTestId("drivethru-lane")
    expect(lane.querySelectorAll("[data-cell]")).toHaveLength(4)
  })

  it("marks only the front car (served first) with the dev data-answer hook", () => {
    render(<DriveThruLane cells={LANE} arrival={ARRIVAL} answerId="c1" selectable />)
    const marked = screen.getByTestId("drivethru-lane").querySelectorAll('[data-answer="1"]')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveAttribute("data-cell", "c1")
  })

  it("does not leak the verdict before the replay (no status region)", () => {
    render(<DriveThruLane cells={LANE} arrival={ARRIVAL} answerId="c1" selectable />)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("commits the front car by tap (keyboard + tap parity via the car button)", () => {
    const onSelectCell = vi.fn()
    render(
      <DriveThruLane cells={LANE} arrival={ARRIVAL} selectable onSelectCell={onSelectCell} />,
    )
    const car = screen.getByTestId("drivethru-lane").querySelector('[data-cell="c1"]') as HTMLElement
    fireEvent.click(car)
    expect(onSelectCell).toHaveBeenCalledWith("c1")
  })

  it("gives each car an accessible name; the front car is at the window", () => {
    render(<DriveThruLane cells={LANE} arrival={ARRIVAL} selectable />)
    const car = screen.getByTestId("drivethru-lane").querySelector('[data-cell="c1"]') as HTMLElement
    expect(car.getAttribute("aria-label")).toContain(front.name)
    expect(car.getAttribute("aria-label")).toContain(front.order)
    expect(car.getAttribute("aria-label")).toContain("at the window")
  })

  it("on serve (popping), the front car leaves the lane and lands in Served", () => {
    render(<DriveThruLane cells={LANE} arrival={ARRIVAL} answerId="c1" popping reducedMotion />)
    const lane = screen.getByTestId("drivethru-lane")
    // exclude the Served slot when counting the lane's cars
    const served = screen.getByTestId("drivethru-served")
    expect(served.querySelector('[data-cell="c1"]')).not.toBeNull()
    // the lane no longer holds the served car; the rest roll forward
    const laneCars = Array.from(lane.querySelectorAll("[data-cell]")).filter(
      (el) => !served.contains(el),
    )
    expect(laneCars).toHaveLength(3)
    expect(laneCars.some((el) => el.getAttribute("data-cell") === "c1")).toBe(false)
  })

  it("snaps for reduced motion", () => {
    render(<DriveThruLane cells={LANE} arrival={ARRIVAL} reducedMotion />)
    expect(screen.getByTestId("drivethru-lane")).toHaveAttribute("data-reduced-motion", "1")
  })
})
