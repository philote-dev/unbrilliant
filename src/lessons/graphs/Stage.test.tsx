import { StrictMode, useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { LessonProgress } from "@/features/lesson/engine"
import {
  graphsReducer,
  resumeGraphs,
  type GraphsPart,
  type GraphsState,
} from "@/features/lesson/graphsEngine"
import { GraphCanvas } from "./GraphCanvas"
import { SubwayMap } from "./SubwayMap"
import { GraphsStage } from "./Stage"

/**
 * DOM tests for the Graphs stage. jsdom can't measure geometry (zeroed rects), so
 * these cover what it CAN: multi-select toggling + the Check gate, the edge-draw
 * committing the same undirected edge by tap AND keyboard through a real
 * RewireSurface, reduced-motion snapping, and the DEV-only e2e hooks.
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

/** A live state at a chosen beat, driven through the real reducer. */
function stateAt(part: GraphsPart, counters: Record<string, number> = {}): GraphsState {
  const progress: LessonProgress = {
    counters: { read: 0, draw: 0, same: 0, attempts: 0, ...counters },
    currentPart: part,
    completed: false,
  }
  return resumeGraphs(progress, SEED)
}

function Harness({ initial }: { initial: GraphsState }) {
  const [state, dispatch] = useReducer(graphsReducer, initial)
  return <GraphsStage state={state} dispatch={dispatch} />
}

const node = (id: string) => screen.getByRole("button", { name: `node ${id}` })
const checkBtn = () => screen.getByRole("button", { name: "Check" })
const sourceEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-rewire-source="${id}"]`)!
const targetEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-rewire-target="${id}"]`)!

describe("read-list (multi-select)", () => {
  it("gates Check until a node is picked, then clears on the exact neighbor set", () => {
    render(<Harness initial={stateAt("read-list")} />)
    expect(checkBtn()).toBeDisabled()

    fireEvent.click(node("A"))
    expect(checkBtn()).toBeEnabled()
    fireEvent.click(node("B"))
    fireEvent.click(node("E")) // C's neighbors = {A, B, E}

    fireEvent.click(checkBtn())
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("a wrong set does not advance (no Continue)", () => {
    render(<Harness initial={stateAt("read-list")} />)
    fireEvent.click(node("A"))
    fireEvent.click(node("B")) // missing E
    fireEvent.click(checkBtn())
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
    expect(checkBtn()).toBeInTheDocument() // still retryable
  })

  it("toggling a node off removes it from the selection", () => {
    render(<Harness initial={stateAt("read-list")} />)
    fireEvent.click(node("A"))
    expect(node("A")).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(node("A"))
    expect(node("A")).toHaveAttribute("aria-pressed", "false")
    expect(checkBtn()).toBeDisabled() // back to empty
  })
})

describe("draw-edge (rewire: node is both source and target)", () => {
  it("commits {B,D} via tap → tap and clears the beat", () => {
    render(<Harness initial={stateAt("draw-edge", { read: 4 })} />)
    expect(checkBtn()).toBeDisabled() // nothing drawn yet

    fireEvent.click(sourceEl("B")) // arm B
    fireEvent.click(targetEl("D")) // drop on D
    expect(checkBtn()).toBeEnabled()

    fireEvent.click(checkBtn())
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("commits the same {B,D} via the keyboard fallback", () => {
    render(<Harness initial={stateAt("draw-edge", { read: 4 })} />)
    const src = sourceEl("B")
    src.focus()
    fireEvent.keyDown(src, { key: "Enter" }) // arm B
    // targets register in node order A,B,C,D,E,F, cycle to D and confirm
    fireEvent.keyDown(src, { key: "ArrowRight" }) // A
    fireEvent.keyDown(src, { key: "ArrowRight" }) // B
    fireEvent.keyDown(src, { key: "ArrowRight" }) // C
    fireEvent.keyDown(src, { key: "ArrowRight" }) // D
    fireEvent.keyDown(src, { key: "Enter" }) // confirm

    expect(checkBtn()).toBeEnabled()
    fireEvent.click(checkBtn())
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("commits a draw under StrictMode (registry stays idempotent)", () => {
    render(
      <StrictMode>
        <Harness initial={stateAt("draw-edge", { read: 4 })} />
      </StrictMode>,
    )
    fireEvent.click(sourceEl("B"))
    fireEvent.click(targetEl("D"))
    fireEvent.click(checkBtn())
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("reduced motion", () => {
  it("snaps (no animation) when reduced motion is requested", () => {
    render(
      <GraphCanvas
        mode="display"
        nodes={["A", "B"]}
        adj={{ A: ["B"], B: ["A"] }}
        layout={{ A: { x: 60, y: 60 }, B: { x: 160, y: 60 } }}
        reducedMotion
      />,
    )
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute("data-reduced-motion", "1")
  })
})

describe("DEV e2e hooks", () => {
  it("marks correct multi-select neighbors and the correct draw source", () => {
    if (!import.meta.env.DEV) return

    const { unmount } = render(<Harness initial={stateAt("read-list")} />)
    expect(document.querySelectorAll('[data-answer="1"]').length).toBe(3) // A, B, E
    unmount()

    render(<Harness initial={stateAt("draw-edge", { read: 4 })} />)
    const marker = document.querySelector("[data-graph-correct-target]")
    expect(marker).not.toBeNull()
    expect(marker).toHaveAttribute("data-rewire-source", "B")
    expect(marker?.getAttribute("data-graph-correct-target")).toBe("D")
  })
})

describe("teach beat: hide-the-picture toggle (visual, no dispatch)", () => {
  it("hides the GraphCanvas by default but always keeps the adjacency list", () => {
    render(<Harness initial={stateAt("teach")} />)
    // Default ON: the picture is hidden, the data carries the beat.
    expect(screen.queryByTestId("graph-canvas")).toBeNull()
    expect(screen.getByText(/Adjacency list/)).toBeInTheDocument()
    expect(screen.getByText("Everything the questions need is right here.")).toBeInTheDocument()

    // Toggling reveals the picture; the data stays put.
    fireEvent.click(screen.getByRole("button", { name: "Show the picture" }))
    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument()
    expect(screen.getByText(/Adjacency list/)).toBeInTheDocument()

    // ...and it toggles back off.
    fireEvent.click(screen.getByRole("button", { name: "Hide the picture" }))
    expect(screen.queryByTestId("graph-canvas")).toBeNull()
  })

  it("does not appear on a graded read beat", () => {
    render(<Harness initial={stateAt("read-list")} />)
    expect(screen.queryByRole("button", { name: /the picture/ })).toBeNull()
  })
})

describe("redraw demo: one subway map morphs geo to diagram over fixed data", () => {
  it("renders a single SubwayMap with a layout toggle and a stable route list", () => {
    render(<Harness initial={stateAt("redraw-demo")} />)
    expect(screen.getAllByTestId("subway-map")).toHaveLength(1)
    // The route list (the data) is present; it never changes through the morph.
    expect(screen.getByText(/Route list/)).toBeInTheDocument()

    // The toggle flips the layout label; the single map + route list persist.
    fireEvent.click(screen.getByRole("button", { name: "Straighten to diagram" }))
    expect(screen.getByRole("button", { name: "Back to street map" })).toBeInTheDocument()
    expect(screen.getAllByTestId("subway-map")).toHaveLength(1)
    expect(screen.getByText(/Route list/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("subway map (reduced motion + draw DEV hooks)", () => {
  it("exposes data-reduced-motion when reduced motion is requested", () => {
    render(
      <SubwayMap
        mode="display"
        nodes={["A", "B"]}
        adj={{ A: ["B"], B: ["A"] }}
        layout={{ A: { x: 60, y: 60 }, B: { x: 200, y: 200 } }}
        variant="geographic"
        reducedMotion
      />,
    )
    expect(screen.getByTestId("subway-map")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("same-graph renders two subway maps side by side", () => {
    render(<Harness initial={stateAt("same-graph")} />)
    expect(screen.getAllByTestId("subway-map")).toHaveLength(2)
  })

  it("the subway draw beat keeps the DEV hooks and commits the missing segment", () => {
    render(<Harness initial={stateAt("draw-transit", { read: 4, draw: 1 })} />)

    // The station markers carry the SAME hooks as GraphCanvas's DrawNode. The
    // draw-transit problem's missing segment is C-D (the route-list "plan" pair).
    if (import.meta.env.DEV) {
      const marker = document.querySelector("[data-graph-correct-target]")
      expect(marker).not.toBeNull()
      expect(marker).toHaveAttribute("data-rewire-source", "C")
      expect(marker?.getAttribute("data-graph-correct-target")).toBe("D")
    }

    // Commit C to D by tap (arm C, drop on D); the beat clears.
    fireEvent.click(sourceEl("C"))
    fireEvent.click(targetEl("D"))
    fireEvent.click(checkBtn())
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})
