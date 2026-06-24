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

describe("teach-extract intro frame (compact-array invariant)", () => {
  it("prepends the 'top leaves, last fills it' frame, then steps into the sift", () => {
    render(<HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />)
    // intro: the original 5-slot heap [9,7,6,3,2] with the why-caption.
    expect(cells()).toHaveLength(5)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Take the top out (9). To keep the array packed with no gaps, the last item (2) moves up to fill the root, then it sinks.",
    )
    // Next: the last item (2) has filled the root, the array is packed to 4 slots.
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(cells()).toHaveLength(4)
    expect(screen.getByLabelText("slot 0, value 2")).toBeInTheDocument()
  })

  it("highlights both the leaving root (0) and the filler (last) slot in the intro", () => {
    render(<HeapsStage state={stateAt("teach-extract")} dispatch={vi.fn()} />)
    const lit = cells().filter((c) => c.getAttribute("data-lit") === "1")
    expect(lit.map((c) => c.getAttribute("data-slot")).sort()).toEqual(["0", "4"])
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
