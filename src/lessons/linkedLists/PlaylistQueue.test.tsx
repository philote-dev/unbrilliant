import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, fireEvent } from "@testing-library/react"

import { RewireSurface } from "@/components/rewire/RewireSurface"
import { NIL, pointerId } from "@/features/lesson/linkedListsEngine"
import { PlaylistQueue } from "./PlaylistQueue"

/**
 * DOM tests for the playlist skin. jsdom can't measure geometry, so these cover
 * the presentational fixes it CAN observe: the grabbed track's arrow stays
 * visible the instant it's armed (no cursor yet), and a dropped track snaps to
 * its drifted end-state under reduced motion instead of tweening.
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

function renderQueue(
  orphaned: string[] = [],
  reducedMotion?: boolean,
  workingNext: Record<string, string> = WORKING,
) {
  return render(
    <RewireSurface legalTargets={LEGAL} onRewire={vi.fn()}>
      <PlaylistQueue
        nodes={NODES}
        newNode="X"
        prev="B"
        workingNext={workingNext}
        orphaned={orphaned}
        rewires={[]}
        reducedMotion={reducedMotion}
      />
    </RewireSurface>,
  )
}

describe("PlaylistQueue", () => {
  it("keeps the grabbed track arrow visible when armed with no cursor", () => {
    const { getByTestId } = renderQueue()
    const source = document.querySelector<HTMLElement>('[data-rewire-source="p:B"]')!
    source.focus()
    fireEvent.keyDown(source, { key: "Enter" }) // arm; no pointer move → no cursor
    expect(getByTestId("armed-arrow")).toBeInTheDocument()
  })

  it("snaps a dropped track to its drifted end-state under reduced motion", () => {
    renderQueue(["C", "D"], true, { ...WORKING, [pointerId("B")]: "X" })
    const orphan = document.querySelector('[aria-label$="dropped from the queue"]')!
    expect(orphan).not.toBeNull()
    expect(orphan).toHaveAttribute("data-reduced-motion", "1")
    expect(orphan).toHaveStyle({ opacity: "0.4" })
  })
})
