import { useReducer } from "react"
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { LessonProgress } from "@/features/lesson/engine"
import {
  resumeTrees,
  treesReducer,
  type TreesPart,
  type TreesState,
} from "@/features/lesson/treesEngine"
import { TreesStage } from "./Stage"

/**
 * DOM tests for the Trees stage. jsdom can't measure geometry (the layout is
 * pure), so these cover the new arc: the watched build snapping to the finished
 * tree under reduced motion, the build-the-BST grow interaction, the bigger
 * find-big descend, the frontier-gated sequence, and the de-cued compare-shape
 * (neutral captions, no verdict on the question screen) with its post-correct
 * RebalanceBracket flourish.
 */

const motionMock = vi.hoisted(() => ({ reduced: false }))
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>()
  return { ...actual, useReducedMotion: () => motionMock.reduced }
})

afterEach(() => {
  motionMock.reduced = false
})

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

function stateAt(part: TreesPart, counters: Record<string, number> = {}): TreesState {
  const progress: LessonProgress = {
    counters: { locate: 0, sequence: 0, build: 0, comparison: 0, attempts: 0, ...counters },
    currentPart: part,
    completed: false,
  }
  return resumeTrees(progress, SEED)
}

function Harness({ initial }: { initial: TreesState }) {
  const [state, dispatch] = useReducer(treesReducer, initial)
  return <TreesStage state={state} dispatch={dispatch} />
}

/** Drive a build to completion by clicking the DEV next-step hook each tap. */
function solveBuildDom() {
  for (let i = 0; i < 40; i++) {
    if (screen.queryByRole("button", { name: "Continue" })) return
    const answer = document.querySelector('[data-answer="1"]')
    if (!answer) throw new Error("expected the next-step DEV hook to be present")
    fireEvent.click(answer)
  }
}

describe("watched-build (teach: watch a BST grow from scratch)", () => {
  it("plays the chained build and snaps to the finished tree under reduced motion", () => {
    motionMock.reduced = true // snap straight to the final frame, no timers
    render(<Harness initial={stateAt("watched-build")} />)
    // the watched build [8,4,12,2,6,10,14] grows the balanced tree; the final
    // frame holds all seven keys, and a teach beat advances on Continue.
    for (const k of [2, 4, 6, 8, 10, 12, 14]) {
      expect(screen.getByLabelText(`node ${k}`)).toBeInTheDocument()
    }
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("build-the-BST (graded: grow it yourself)", () => {
  it("opens with the root placed and the Build bin header", () => {
    render(<Harness initial={stateAt("build-bst-1")} />)
    expect(screen.getByText(/Build ·.*correct/)).toBeInTheDocument()
    // build-bst-1 grows [6,4,9,2,5,8]: 6 is the root, ready to grow.
    expect(screen.getByLabelText("node 6")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })

  it("grows the tree by dropping each key, then offers Continue", () => {
    render(<Harness initial={stateAt("build-bst-1")} />)
    solveBuildDom()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("a wrong drop nudges without advancing (no fail wall)", () => {
    render(<Harness initial={stateAt("build-bst-1")} />)
    // current key 4 drops left of 6; tapping the wrong (right) slot nudges.
    const wrong = document.querySelector('[data-ghost-side="right"]')
    expect(wrong).not.toBeNull()
    fireEvent.click(wrong as Element)
    expect(screen.getByText(/Compare the incoming key/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })
})

describe("find-big (bigger descend tree)", () => {
  it("renders the larger 13-node tree as a Locate descend", () => {
    render(<Harness initial={stateAt("find-big", { locate: 3 })} />)
    expect(screen.getByText(/Locate ·.*correct/)).toBeInTheDocument()
    // the generated find-big tree is 13 nodes (vs the 7-node canonical tree).
    expect(document.querySelectorAll("[data-node-id]")).toHaveLength(13)
  })
})

describe("sequence (frontier-gated at the stage)", () => {
  it("exposes only the next in-order node as tappable", () => {
    render(<Harness initial={stateAt("sequence-a")} />)
    expect(document.querySelectorAll("[data-tappable]")).toHaveLength(1)
  })

  it("sequence-c renders the larger nine-node shape", () => {
    render(<Harness initial={stateAt("sequence-c", { sequence: 2 })} />)
    expect(document.querySelectorAll("[data-node-id]")).toHaveLength(9)
  })
})

describe("compare-shape (de-cued + RebalanceBracket flourish)", () => {
  it("shows neutral captions and never leaks the verdict on the question screen", () => {
    render(<Harness initial={stateAt("compare-shape")} />)
    // neutral option labels (no verdict)
    expect(screen.getByText("Tree A reaches it in fewer steps")).toBeInTheDocument()
    expect(screen.getByText("Both take the same number of steps")).toBeInTheDocument()
    // no verdict tokens anywhere at idle (captions, costs, feedback all withheld)
    expect(screen.queryByText(/halv|walk|balanced|stick|same keys/i)).toBeNull()
    // the rebalance flourish is not mounted until a correct answer
    expect(screen.queryByTestId("rebalance-bracket")).toBeNull()
  })

  it("mounts the RebalanceBracket flourish only after a correct answer (non-gating)", () => {
    const s = stateAt("compare-shape")
    const correct = treesReducer(
      treesReducer(s, { type: "select", letter: "a-fewer" }),
      { type: "check" },
    )
    expect(correct.feedback).toBe("correct")
    render(<TreesStage state={correct} dispatch={vi.fn()} />)
    expect(screen.getByTestId("rebalance-bracket")).toBeInTheDocument()
  })
})
