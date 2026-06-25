import { useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { LessonProgress } from "@/features/lesson/engine"
import {
  hashTablesReducer,
  resumeHashTables,
  type HashPart,
  type HashTablesState,
} from "@/features/lesson/hashTablesEngine"
import { HashTablesStage } from "./Stage"

/**
 * DOM tests for the Hash Tables stage. jsdom can't measure geometry, so these
 * cover the deterministic interaction the lookup trace adds: an explicit
 * "Trace the lookup" button that walks a LOCAL cursor over the bucket's chain,
 * lighting each node and announcing progress to a live region. The verdict still
 * comes from the engine; the trace is illustration only.
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

function stateAt(part: HashPart, counters: Record<string, number> = {}): HashTablesState {
  const progress: LessonProgress = {
    counters: { hash: 0, collision: 0, lookup: 0, attempts: 0, ...counters },
    currentPart: part,
    completed: false,
  }
  return resumeHashTables(progress, SEED)
}

function Harness({ initial }: { initial: HashTablesState }) {
  const [state, dispatch] = useReducer(hashTablesReducer, initial)
  return <HashTablesStage state={state} dispatch={dispatch} />
}

const traceBtn = () => screen.getByRole("button", { name: "Scan the bin" })

describe("lookup trace (illustration only)", () => {
  it("walks the chain step by step and announces the hit", () => {
    render(<Harness initial={stateAt("lookup-found")} />)

    fireEvent.click(traceBtn()) // check owl
    expect(screen.getByText("checking owl")).toBeInTheDocument()

    fireEvent.click(traceBtn()) // check fox → found
    expect(
      screen.getByText("checking owl, checking fox, found fox in bin 0"),
    ).toBeInTheDocument()

    // the matched node is flagged for assistive tech, and the trail is complete
    expect(document.querySelector("[aria-current='step']")?.textContent).toContain("fox")
    expect(traceBtn()).toBeDisabled()
  })

  it("an absent lookup ends with 'absent'", () => {
    render(<Harness initial={stateAt("lookup-absent")} />)
    fireEvent.click(traceBtn())
    expect(screen.getByText(/not in bin 3, absent/)).toBeInTheDocument()
    expect(traceBtn()).toBeDisabled()
  })

  it("does not offer the scan on a non-lookup tap beat (hash-cat-again)", () => {
    render(<Harness initial={stateAt("hash-cat-again", { hash: 1 })} />)
    expect(screen.queryByRole("button", { name: "Scan the bin" })).toBeNull()
  })
})
