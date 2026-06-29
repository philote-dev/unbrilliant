import { useReducer } from "react"
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { LessonProgress } from "@/features/lesson/engine"
import {
  heapsReducer,
  nextSwap,
  resumeHeaps,
  type HeapsPart,
  type HeapsState,
} from "@/features/lesson/heapsEngine"
import { HeapsStage } from "./Stage"

// A controllable reduced-motion flag so reduced-motion paths can be tested (Motion
// caches its media-query state, so overriding window.matchMedia per test does not
// flip it; mocking the hook is the reliable way).
const motionMock = vi.hoisted(() => ({ reduced: false }))
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>()
  return { ...actual, useReducedMotion: () => motionMock.reduced }
})

afterEach(() => {
  motionMock.reduced = false
})

/**
 * DOM tests for the Heaps stage. jsdom can't measure geometry, so these cover the
 * synced manual stepper: the prepended extract intro frame (the compact-array
 * "why"), the extract reveal, and the demo driving each insert through the same
 * Back/Next/Replay replay instead of snapping to the landing slot.
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

const SEED = 12345

function stateAt(part: HeapsPart, counters: Record<string, number> = {}): HeapsState {
  const progress: LessonProgress = {
    counters: { siftUp: 0, siftDown: 0, mapping: 0, contrast: 0, attempts: 0, ...counters },
    currentPart: part,
    completed: false,
  }
  return resumeHeaps(progress, SEED)
}

function Harness({ initial }: { initial: HeapsState }) {
  const [state, dispatch] = useReducer(heapsReducer, initial)
  return <HeapsStage state={state} dispatch={dispatch} />
}

const cells = () => screen.getAllByTestId("heap-cell")
const triageCells = () => screen.getAllByTestId("triage-cell")
const triageCellAt = (slot: number) =>
  triageCells().find((c) => c.getAttribute("data-slot") === String(slot))

/**
 * Perform the next correct do-the-sift swap by clicking the two array cells the
 * engine marks with the DEV-only `data-sift-from` / `data-sift-to` hooks. This keeps
 * the DOM tests independent of the (now seeded-generated) heap values.
 */
function performNextSwap() {
  const from = document.querySelector("[data-sift-from]")
  const to = document.querySelector("[data-sift-to]")
  if (!from || !to) throw new Error("expected the next-swap DEV hooks to be present")
  fireEvent.click(from)
  fireEvent.click(to)
}

/** Perform every correct swap until the beat settles and Continue appears. */
function solveSiftDom() {
  for (let i = 0; i < 12; i++) {
    if (screen.queryByRole("button", { name: "Continue" })) return
    performNextSwap()
  }
}

describe("teach-extract intro frame (compact-array invariant, ER skin)", () => {
  it("prepends the 'top leaves, last fills it' frame on the triage board, then steps into the sift", () => {
    render(<HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />)
    // intro: the original 5-patient board [90,80,70,40,30] with the why-caption.
    expect(triageCells()).toHaveLength(5)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Take the top out (90). To keep the array packed with no gaps, the last item (30) moves up to fill the root, then it sinks.",
    )
    // Next: the last patient (30) has filled the top spot, the board packs to 4 slots.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(triageCells()).toHaveLength(4)
    expect(triageCellAt(0)).toHaveAttribute("data-value", "30")
  })

  it("highlights both the leaving root (0) and the filler (last) slot in the intro", () => {
    render(<HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />)
    const lit = triageCells().filter((c) => c.getAttribute("data-lit") === "1")
    expect(lit.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["0", "4"])
  })
})

describe("slot beats: neutral pre-verdict screen-reader label (no answer leak)", () => {
  it("voices the task without naming the mapped slot until the verdict", () => {
    const s = stateAt("map-child")
    const { rerender } = render(<HeapsStage state={s} dispatch={vi.fn()} />)
    // pre-verdict: the figure status states the subject + task, never the target slot.
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent(
      "Slot 0 holds 9. Tap the array cell you think is its larger child.",
    )
    expect(status).not.toHaveTextContent("the larger is slot 1")

    // once correct, the mapped slot is safe to voice.
    const correct = heapsReducer(
      heapsReducer(s, { type: "select", letter: s.question!.answer }),
      { type: "check" },
    )
    rerender(<HeapsStage state={correct} dispatch={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("the larger is slot 1")
  })
})

describe("do-the-sift (active sift-up mechanic)", () => {
  it("a correct swap travels the node and advances the sift (no Continue yet)", () => {
    // The bigger generated rep is guaranteed multi-swap, so one swap advances it
    // without settling the heap.
    const s = stateAt("siftup-2")
    render(<Harness initial={s} />)
    const heap = s.sift!.heap
    const sw = nextSwap(s.sift!)!
    const mover = heap[sw.a]
    expect(cells()).toHaveLength(heap.length)
    expect(screen.getByLabelText(`slot ${sw.a}, value ${mover}`)).toBeInTheDocument()

    // Tap the climbing key, then its parent: the correct first swap travels it up.
    fireEvent.click(screen.getByLabelText(`slot ${sw.a}, value ${mover}`))
    fireEvent.click(screen.getByLabelText(`slot ${sw.b}, value ${heap[sw.b]}`))
    expect(screen.getByLabelText(`slot ${sw.b}, value ${mover}`)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })

  it("a wrong swap nudges and leaves the heap untouched (no fail wall)", () => {
    const s = stateAt("siftup-1")
    render(<Harness initial={s} />)
    const heap = s.sift!.heap
    const sw = nextSwap(s.sift!)!
    const mover = heap[sw.a]
    const wrongSlot = heap.findIndex((_, i) => i !== sw.a && i !== sw.b)

    // Tap the climbing key, then a slot that is not its parent: a wrong move.
    fireEvent.click(screen.getByLabelText(`slot ${sw.a}, value ${mover}`))
    fireEvent.click(screen.getByLabelText(`slot ${wrongSlot}, value ${heap[wrongSlot]}`))
    // The heap did not change (the key is still at its slot) and a nudge is shown.
    expect(screen.getByLabelText(`slot ${sw.a}, value ${mover}`)).toBeInTheDocument()
    expect(screen.getByText(/rises only while it beats its parent/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })

  it("completing the sift clears the beat and offers Continue", () => {
    render(<Harness initial={stateAt("siftup-1")} />)
    solveSiftDom()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("do-the-sift (sift-down, reduced motion skips the hand-off)", () => {
  it("opens interactive at the post-hand-off heap and sinks the new root", () => {
    motionMock.reduced = true // skip the one-shot hand-off; interactive at once
    const s = stateAt("siftdown-1")
    render(<Harness initial={s} />)
    const heap = s.sift!.heap // the last leaf is already lifted to the root
    expect(cells()).toHaveLength(heap.length)
    expect(screen.getByLabelText(`slot 0, value ${heap[0]}`)).toBeInTheDocument()

    // Sink the new root via the larger child, all the way down.
    solveSiftDom()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("de-cued map beats (no answer arc at idle)", () => {
  it("draws no connector / answer arc at idle on the graded map beats", () => {
    for (const part of ["map-child", "map-parent"] as const) {
      const { unmount } = render(<HeapsStage state={stateAt(part)} dispatch={vi.fn()} />)
      expect(screen.queryAllByTestId("heap-connector")).toHaveLength(0)
      unmount()
    }
  })

  it("restores the connector on the post-commit reveal (kept for the explanation)", () => {
    let s = stateAt("map-parent")
    s = heapsReducer(s, { type: "select", letter: s.question!.answer })
    s = heapsReducer(s, { type: "check" })
    expect(s.feedback).toBe("correct")
    render(<HeapsStage state={s} dispatch={vi.fn()} />)
    expect(screen.queryAllByTestId("heap-connector").length).toBeGreaterThan(0)
  })
})

describe("MonitorChrome reduced-motion gap", () => {
  it("the Live dot pulses with motion on, and stops under reduced motion", () => {
    const { container, unmount } = render(
      <HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />,
    )
    expect(container.querySelector("span.bg-red-500")?.className).toContain("animate-pulse")
    unmount()

    motionMock.reduced = true
    const reduced = render(<HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />)
    const dot = reduced.container.querySelector("span.bg-red-500")
    expect(dot).not.toBeNull()
    expect(dot?.className).not.toContain("animate-pulse")
  })
})

describe("demo: free-play insert sandbox", () => {
  it("starts empty and inserts a key, dropping it into the heap (tree + array)", () => {
    render(<Harness initial={stateAt("demo")} />)
    // before any insert: an empty board, no cells, with the first key on offer.
    expect(screen.queryAllByTestId("heap-cell")).toHaveLength(0)
    expect(screen.getByText(/empty heap/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Insert 42" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Insert 42" }))
    // 42 has dropped into the first slot, and the next key is offered.
    expect(screen.getByLabelText("slot 0, value 42")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Insert 17" })).toBeInTheDocument()
  })

  it("clears the board back to empty so the learner can build again", () => {
    render(<Harness initial={stateAt("demo")} />)
    fireEvent.click(screen.getByRole("button", { name: "Insert 42" }))
    expect(screen.getByLabelText("slot 0, value 42")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    // back to empty, and the pool resets to the first key.
    expect(screen.queryByLabelText("slot 0, value 42")).toBeNull()
    expect(screen.getByText(/empty heap/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Insert 42" })).toBeInTheDocument()
  })
})

describe("watched-build (teach: watch a heap built from scratch)", () => {
  it("plays the chained build, snapping to the finished heap under reduced motion", () => {
    motionMock.reduced = true // snap straight to the final frame, no timers
    render(<Harness initial={stateAt("watched-build")} />)
    // the watched build [12,30,24,41,35] settles at [41,35,24,12,30] (5 slots).
    expect(cells()).toHaveLength(5)
    expect(screen.getByLabelText("slot 0, value 41")).toBeInTheDocument()
    // a teach beat advances on Continue (it never grades).
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("build-a-heap (graded: build it yourself, sifting each insert)", () => {
  it("opens with the first key auto-placed and sifts the next one into place", () => {
    render(<Harness initial={stateAt("build-a-heap", { siftUp: 2 })} />)
    // build-a-heap [18,27,24,40,33,36] opens at [18,27]: 18 is placed, 27 ready to climb.
    expect(cells()).toHaveLength(2)
    expect(screen.getByLabelText("slot 1, value 27")).toBeInTheDocument()
    expect(screen.getByText(/Build ·.*correct/)).toBeInTheDocument() // the build bin header

    // Tap 27, then its parent 18: the correct first swap settles 27 to the root,
    // then 24 auto-places and 40 drops in, ready to sift.
    fireEvent.click(screen.getByLabelText("slot 1, value 27"))
    fireEvent.click(screen.getByLabelText("slot 0, value 18"))
    expect(screen.getByLabelText("slot 0, value 27")).toBeInTheDocument()
    expect(screen.getByLabelText("slot 3, value 40")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull() // not built yet
  })

  it("a wrong sub-move nudges without advancing (no fail wall)", () => {
    const s = stateAt("build-a-heap", { siftUp: 2 })
    // advance one correct swap so a genuinely wrong pair exists (heap [27,18,24,40]).
    const mid = heapsReducer(s, { type: "rewire", from: "slot-1", to: "slot-0" })
    render(<Harness initial={mid} />)
    // a wrong swap (slots 2 and 0) leaves the board and offers a nudge.
    fireEvent.click(screen.getByLabelText("slot 2, value 24"))
    fireEvent.click(screen.getByLabelText("slot 0, value 27"))
    expect(screen.getByText(/rises only while it beats its parent/i)).toBeInTheDocument()
    expect(screen.getByLabelText("slot 3, value 40")).toBeInTheDocument() // unchanged
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })
})

describe("ER extract skin (siftup-skin → do-the-sift discharge on the board)", () => {
  it("renders the clinical ER board (not the dual view) and sinks the new top to Continue", () => {
    motionMock.reduced = true // skip the extract hand-off; interactive at once
    render(<Harness initial={stateAt("siftup-skin", { siftUp: 2, siftDown: 2 })} />)
    // it transforms into the clinical ER monitor, not the plain dual view.
    expect(screen.getByTestId("er-triage-board")).toBeInTheDocument()
    expect(screen.queryByTestId("heap-dual-view")).toBeNull()
    expect(triageCells().length).toBeGreaterThan(0)
    // performing the discharge sift to completion clears the beat → Continue.
    solveSiftDom()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("ER synthesis (er-synthesis → multi-step do-the-sift, one slot)", () => {
  const fullPriorBins = { siftUp: 2, siftDown: 3, mapping: 2, contrast: 2, build: 1 }

  it("shows the three ER phases and only offers Continue once every op is performed", () => {
    motionMock.reduced = true
    render(<Harness initial={stateAt("er-synthesis", fullPriorBins)} />)
    expect(screen.getByTestId("er-triage-board")).toBeInTheDocument()
    // the phase rail lists the whole synthesis: admit → discharge → re-triage.
    expect(screen.getByText("Admit")).toBeInTheDocument()
    expect(screen.getByText("Discharge")).toBeInTheDocument()
    expect(screen.getByText("Re-triage")).toBeInTheDocument()
    // one graded slot: no Continue mid-sequence, only after the final op.
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
    solveSiftDom()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("a wrong sub-move nudges without advancing the synthesis (no fail wall)", () => {
    motionMock.reduced = true
    render(<Harness initial={stateAt("er-synthesis", fullPriorBins)} />)
    // the admit mover + its correct target carry the DEV next-swap hooks.
    const fromSlot = document.querySelector("[data-sift-from]")!.getAttribute("data-slot")
    const toSlot = document.querySelector("[data-sift-to]")!.getAttribute("data-slot")
    // hold the mover, then tap a patient that is NOT its correct target: a wrong move.
    fireEvent.click(document.querySelector("[data-sift-from]") as HTMLElement)
    const wrong = triageCells().find((c) => {
      const slot = c.getAttribute("data-slot")
      return slot !== fromSlot && slot !== toSlot
    }) as HTMLElement
    fireEvent.click(wrong)
    expect(screen.getByText(/admit sifts up/i)).toBeInTheDocument() // the synthesis nudge copy
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })
})
