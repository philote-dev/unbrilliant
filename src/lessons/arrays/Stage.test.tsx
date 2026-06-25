import { useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  arraysReducer,
  resumeArrays,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { ArraysStage } from "./Stage"

/**
 * DOM tests for the Arrays stage. Reduced motion is forced (matchMedia matches),
 * so the parking-lot wave parks on its snapped end-state with no timers, keeping
 * these deterministic. They cover the seams that matter: that the ParkingLot skin
 * is actually wired into the Stage (a revert canary, since a Dropbox `.git` sync
 * once silently reverted the wiring while the isolated unit tests stayed green),
 * the idle-only regenerate gate, the POST-VERDICT wave + announcement (never
 * before), and the locked cost-chip words rendered from the engine verbatim.
 */
beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
})

const SEED = 7

function Harness({ initial }: { initial: ArraysState }) {
  const [state, dispatch] = useReducer(arraysReducer, initial)
  return <ArraysStage state={state} dispatch={dispatch} />
}

/** A live state seeded at a chosen part with the prior quotas already met. */
function stateAt(part: "shift" | "cost" | "resize"): ArraysState {
  const counters: Record<string, number> = { shiftPredict: 3, costCount: 3 }
  if (part === "shift") return resumeArrays({ counters: {}, currentPart: "shift", completed: false }, SEED)
  return resumeArrays({ counters, currentPart: part, completed: false }, SEED)
}

/** The access intro state (the lot is interactive there). */
function accessState(): ArraysState {
  return resumeArrays({ counters: {}, currentPart: "access", completed: false }, SEED)
}

/** Re-roll (in idle) until the resize instance lands on a chosen verdict. */
function resizeStateAnswering(answer: "yes" | "no"): ArraysState {
  let s = stateAt("resize")
  while (s.question!.answer !== answer) s = arraysReducer(s, { type: "reattempt" })
  return s
}

const clickCorrect = () => {
  const card = document.querySelector('[data-answer="1"]') as HTMLElement
  fireEvent.click(card)
  fireEvent.click(screen.getByRole("button", { name: "Check" }))
}

describe("Arrays stage — the ParkingLot skin is actually wired in (revert canary)", () => {
  it("renders the parking lot (not the abstract array) across every beat", () => {
    // access intro
    const access = render(<Harness initial={accessState()} />)
    expect(screen.getByTestId("parking-lot")).toBeInTheDocument()
    expect(screen.getAllByTestId("bay").length).toBeGreaterThan(0)
    access.unmount()

    // shift / cost predicts
    for (const part of ["shift", "cost"] as const) {
      const r = render(<Harness initial={stateAt(part)} />)
      expect(screen.getByTestId("parking-lot")).toBeInTheDocument()
      expect(screen.getAllByTestId("car").length).toBeGreaterThan(0)
      r.unmount()
    }

    // resize (was blank before the skin): the lot draws bays AND its filled cars,
    // so this also guards the engine's structured array fill from reverting.
    render(<Harness initial={stateAt("resize")} />)
    expect(screen.getByTestId("parking-lot")).toBeInTheDocument()
    expect(screen.getAllByTestId("bay").length).toBeGreaterThan(0)
    expect(screen.getAllByTestId("car").length).toBeGreaterThan(0)

    // and the OLD abstract step-player viz must be gone.
    expect(screen.queryByTestId("shift-wave")).toBeNull()
    expect(screen.queryByTestId("resize-block")).toBeNull()
  })
})

describe("Arrays stage — regenerate is gated to idle", () => {
  it("offers a re-roll while idle, and hides it once a verdict lands", () => {
    render(<Harness initial={stateAt("shift")} />)
    expect(screen.getByLabelText("Regenerate this example")).toBeInTheDocument()

    clickCorrect()
    // post-verdict: the re-roll is gone, so it can never dodge the mastery wall.
    expect(screen.queryByLabelText("Regenerate this example")).toBeNull()
  })

  it("a re-roll keeps the learner on the same part (no quota skip)", () => {
    render(<Harness initial={stateAt("shift")} />)
    fireEvent.click(screen.getByLabelText("Regenerate this example"))
    // still a fresh, ungraded shift predict: Check is back and re-roll is offered.
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument()
    expect(screen.getByLabelText("Regenerate this example")).toBeInTheDocument()
  })
})

describe("Arrays stage — the parking-lot wave fires post-verdict", () => {
  it("shows the lot but no arrival car or spoken result before the verdict", () => {
    render(<Harness initial={stateAt("shift")} />)
    // the lot (the live structure) is always present, with its cars parked…
    expect(screen.getByTestId("parking-lot")).toBeInTheDocument()
    expect(screen.getAllByTestId("car").length).toBeGreaterThan(0)
    // …but the wave's tells (arrival car, spoken result, cost chip) wait for the verdict.
    expect(document.querySelector('[data-arrival="1"]')).toBeNull()
    expect(screen.queryByText(/rolled (forward|back)/)).toBeNull()
    expect(screen.queryByText("scales")).toBeNull()
  })

  it("announces the result and shows the 'scales' chip once correct", () => {
    render(<Harness initial={stateAt("shift")} />)
    clickCorrect()

    expect(screen.getByText("scales")).toBeInTheDocument()
    expect(screen.getByText(/rolled (forward|back)/)).toBeInTheDocument()
  })
})

describe("Arrays stage — resize chip reads the locked house word", () => {
  it("a triggered resize shows the doubling lot and the 'usually free' chip", () => {
    render(<Harness initial={resizeStateAnswering("yes")} />)
    clickCorrect()

    expect(screen.getByTestId("parking-lot")).toBeInTheDocument()
    expect(screen.getByText("usually free")).toBeInTheDocument()
    expect(screen.queryByText("scales")).toBeNull()
    expect(screen.getByText(/Doubled to \d+ bays/)).toBeInTheDocument()
  })

  it("a no-resize insert shows the 'free' chip and parks the new car", () => {
    render(<Harness initial={resizeStateAnswering("no")} />)
    clickCorrect()

    expect(screen.getByText("free")).toBeInTheDocument()
    expect(screen.getByText(/parks in bay \d+/)).toBeInTheDocument()
  })
})
