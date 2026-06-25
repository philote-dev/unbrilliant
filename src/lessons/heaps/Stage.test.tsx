import { useReducer } from "react"
import { describe, it, expect, beforeAll, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { LessonProgress } from "@/features/lesson/engine"
import {
  heapsReducer,
  resumeHeaps,
  type HeapsPart,
  type HeapsState,
} from "@/features/lesson/heapsEngine"
import { HeapsStage } from "./Stage"

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

describe("teach-extract intro frame (compact-array invariant, ER skin)", () => {
  it("prepends the 'top leaves, last fills it' frame on the triage board, then steps into the sift", () => {
    render(<HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />)
    // intro: the original 5-patient board [9,7,6,3,2] with the why-caption.
    expect(triageCells()).toHaveLength(5)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Take the top out (9). To keep the array packed with no gaps, the last item (2) moves up to fill the root, then it sinks.",
    )
    // Next: the last patient (2) has filled the top spot, the board packs to 4 slots.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(triageCells()).toHaveLength(4)
    expect(triageCellAt(0)).toHaveAttribute("data-value", "2")
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

describe("extract reveal (sift-down beat)", () => {
  it("the post-correct replay opens on the intro frame, not the moved-to-root state", () => {
    let s = stateAt("siftdown-1")
    s = heapsReducer(s, { type: "select", letter: s.question!.answer })
    s = heapsReducer(s, { type: "check" })
    expect(s.feedback).toBe("correct")

    render(<HeapsStage state={s} dispatch={vi.fn()} />)
    // siftdown-1 heap = [9,7,6,3,2]: the intro shows all 5 slots + the why.
    expect(cells()).toHaveLength(5)
    expect(screen.getByRole("status")).toHaveTextContent("Take the top out (9)")
  })
})

describe("demo: per-insert synced replay", () => {
  it("drives an insert through the stepper (drop-in -> swaps), not a snap", () => {
    render(<Harness initial={stateAt("demo")} />)
    // before any insert: the starting 5-slot heap, and no stepper yet.
    expect(cells()).toHaveLength(5)
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Insert 8" }))
    // the appended 6-slot drop-in frame + the manual stepper appears.
    expect(cells()).toHaveLength(6)
    expect(screen.getByText("8 drops into the next open slot.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument()

    // step the sift to the end: 8 climbs to the root, array stays 6 slots.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(cells()).toHaveLength(6)
    expect(screen.getByLabelText("slot 0, value 8")).toBeInTheDocument()
  })

  it("offers a fresh insert after stepping the first one", () => {
    render(<Harness initial={stateAt("demo")} />)
    fireEvent.click(screen.getByRole("button", { name: "Insert 8" }))
    // the next key (11) is now on offer; the demo keeps building on the result.
    expect(screen.getByRole("button", { name: "Insert 11" })).toBeInTheDocument()
  })
})
