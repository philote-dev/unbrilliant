import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, fireEvent } from "@testing-library/react"

import { RewireSurface } from "@/components/rewire/RewireSurface"
import { NIL, pointerId } from "@/features/lesson/linkedListsEngine"
import { NodeGraph } from "./NodeGraph"

/**
 * DOM tests for the figure. jsdom can't measure geometry (zeroed rects), so these
 * cover what it CAN: that tap and keyboard both reach the engine with the same
 * `(from, to)` intent as a drag would, and that reduced-motion snaps (no drift).
 */

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })
  }
})

const NODES = ["A", "B", "C", "D"]
const WORKING: Record<string, string> = {
  [pointerId("A")]: "B",
  [pointerId("B")]: "C",
  [pointerId("C")]: "D",
  [pointerId("D")]: NIL,
}
const LEGAL = new Set([...NODES, "X"])
const REWIRES = [
  { from: pointerId("X"), to: "C" },
  { from: pointerId("B"), to: "X" },
]

function renderGraph(onRewire = vi.fn(), reducedMotion?: boolean) {
  const utils = render(
    <RewireSurface legalTargets={LEGAL} onRewire={onRewire}>
      <NodeGraph
        mode="rewire"
        nodes={NODES}
        newNode="X"
        prev="B"
        at="C"
        workingNext={WORKING}
        legal={LEGAL}
        orphaned={[]}
        rewires={REWIRES}
        reducedMotion={reducedMotion}
      />
    </RewireSurface>,
  )
  return { onRewire, ...utils }
}

describe("NodeGraph", () => {
  it("snaps (no drift animation) when reduced motion is requested", () => {
    const { getByTestId } = renderGraph(vi.fn(), true)
    expect(getByTestId("node-graph")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("commits a rewire via tap → tap (same intent a drag would emit)", () => {
    const { onRewire } = renderGraph()
    const source = document.querySelector<HTMLElement>('[data-rewire-source="p:X"]')!
    const targetC = document.querySelector<HTMLElement>('[data-rewire-target="C"]')!
    fireEvent.click(source) // arm X's pointer
    fireEvent.click(targetC) // drop on C
    expect(onRewire).toHaveBeenCalledWith("p:X", "C")
  })

  it("commits a rewire via the keyboard fallback to the chosen target (same intent as tap)", () => {
    const { onRewire } = renderGraph()
    const source = document.querySelector<HTMLElement>('[data-rewire-source="p:X"]')!
    source.focus()
    fireEvent.keyDown(source, { key: "Enter" }) // arm X's pointer
    // Targets register in DOM order (A, B, C, D, X); cycle to C and confirm.
    fireEvent.keyDown(source, { key: "ArrowRight" }) // A
    fireEvent.keyDown(source, { key: "ArrowRight" }) // B
    fireEvent.keyDown(source, { key: "ArrowRight" }) // C
    fireEvent.keyDown(source, { key: "Enter" }) // confirm
    expect(onRewire).toHaveBeenCalledTimes(1)
    expect(onRewire).toHaveBeenCalledWith("p:X", "C")
  })

  it("renders no grip for an orphaned node's pointer (it can't be grabbed)", () => {
    render(
      <RewireSurface legalTargets={new Set(["A", "B", "X"])} onRewire={vi.fn()}>
        <NodeGraph
          mode="rewire"
          nodes={NODES}
          newNode="X"
          prev="B"
          at="C"
          workingNext={{ ...WORKING, [pointerId("B")]: "X" }}
          legal={new Set(["A", "B", "X"])}
          orphaned={["C", "D"]}
          rewires={REWIRES}
        />
      </RewireSurface>,
    )
    expect(document.querySelector('[data-rewire-source="p:C"]')).toBeNull()
    expect(document.querySelector('[data-rewire-source="p:D"]')).toBeNull()
    expect(document.querySelector('[data-rewire-source="p:B"]')).not.toBeNull()
  })

  it("keeps the grabbed arrow visible when armed with no cursor/hover (keyboard-arm)", () => {
    const { getByTestId } = renderGraph()
    const source = document.querySelector<HTMLElement>('[data-rewire-source="p:X"]')!
    source.focus()
    // Arm via the keyboard: there is no pointer, so the live stretch has no
    // endpoint, so the figure must still draw a "lifted" stub, not vanish.
    fireEvent.keyDown(source, { key: "Enter" })
    expect(getByTestId("armed-arrow")).toBeInTheDocument()
  })

  it("snaps an orphaned node to its drifted end-state under reduced motion", () => {
    render(
      <RewireSurface legalTargets={new Set(["A", "B", "X"])} onRewire={vi.fn()}>
        <NodeGraph
          mode="rewire"
          nodes={NODES}
          newNode="X"
          prev="B"
          at="C"
          workingNext={{ ...WORKING, [pointerId("B")]: "X" }}
          orphaned={["C", "D"]}
          rewires={REWIRES}
          reducedMotion
        />
      </RewireSurface>,
    )
    const orphan = document.querySelector('[aria-label="C, orphaned"]')!
    expect(orphan).not.toBeNull()
    expect(orphan).toHaveAttribute("data-reduced-motion", "1")
    // initial={false} renders straight at the drifted end-state (faded), no tween.
    expect(orphan).toHaveStyle({ opacity: "0.6" })
  })
})
