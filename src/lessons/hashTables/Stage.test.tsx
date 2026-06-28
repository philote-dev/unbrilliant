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

/** Step the HashBox letter-by-letter to completion (cat has 3 letters). */
function addAllLetters() {
  let step = screen.queryByRole("button", { name: /Add (the|next) letter/ })
  let guard = 0
  while (step && guard++ < 10) {
    fireEvent.click(step)
    step = screen.queryByRole("button", { name: /Add (the|next) letter/ })
  }
}

describe("abstract demo (beat 1, Willow-styled, not the warehouse)", () => {
  it("offers the two scenarios and never wears the warehouse skin", () => {
    render(<Harness initial={stateAt("demo")} />)
    // The abstract two-scenario sandbox, not the chaotic-storage warehouse.
    expect(screen.getByRole("button", { name: "Scan a sorted list" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Jump with a hash" })).toBeInTheDocument()
    expect(screen.queryByText(/Fulfilment Center/i)).toBeNull()
    expect(screen.queryByText(/Stow station/i)).toBeNull()
  })

  it("Continue advances to the interactive teach", () => {
    render(<Harness initial={stateAt("demo")} />)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(screen.getByText("A key knows its own bin")).toBeInTheDocument()
  })
})

describe("teach-hash (interactive HashBox reveal)", () => {
  it("steps the letters, computes the bin, and lands the key (non-graded)", () => {
    render(<Harness initial={stateAt("teach-hash")} />)
    // Withheld until the learner runs the box.
    expect(screen.getByText("?")).toBeInTheDocument()
    addAllLetters()
    // cat -> 24 mod 5 = 4: the bin is revealed and the key lands.
    expect(screen.queryByText("?")).toBeNull()
    expect(screen.getByText("bin 4")).toBeInTheDocument()
    expect(screen.getAllByText("cat").length).toBeGreaterThan(0)
    // It stays a teach beat: Continue, never Check.
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull()
  })
})

describe("make-a-hash sandbox (beat 10, free play)", () => {
  it("exposes the rule + bucket controls and a live collision count", () => {
    render(<Harness initial={stateAt("hash-build-demo")} />)
    expect(screen.getByRole("button", { name: "Sum the letters" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "First letter only" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Length only" })).toBeInTheDocument()
    for (const n of ["4", "5", "6", "7"]) {
      expect(screen.getByRole("button", { name: n })).toBeInTheDocument()
    }
  })

  it("dropping the pool and weakening the rule piles keys up (more collisions)", () => {
    render(<Harness initial={stateAt("hash-build-demo")} />)
    fireEvent.click(screen.getByRole("button", { name: "Drop all" }))
    // sum + 5 leaves two pairs sharing a bin.
    expect(screen.getByText("2 keys collide")).toBeInTheDocument()
    // length ignores the letters: all six pile into one bin.
    fireEvent.click(screen.getByRole("button", { name: "Length only" }))
    expect(screen.getByText("5 keys collide")).toBeInTheDocument()
  })
})

describe("hash-design challenge (beat 11, graded design bin)", () => {
  it("opens on a colliding choice; the design header shows the design bin", () => {
    render(<Harness initial={stateAt("hash-design")} />)
    expect(screen.getByText(/Design · 0 \/ 1 correct/)).toBeInTheDocument()
    // First-letter only piles cat and cap together.
    expect(screen.getByText("1 key collides")).toBeInTheDocument()
  })

  it("switching to a whole-key rule spreads the keys and clears the beat", () => {
    render(<Harness initial={stateAt("hash-design")} />)
    fireEvent.click(screen.getByRole("button", { name: "Sum the letters" }))
    // sum + 5 (the seeded default bucket count) gives each key its own bin.
    expect(screen.getByText(/No collisions/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    expect(
      screen.getByText("No collisions. Every key has its own bin."),
    ).toBeInTheDocument()
  })

  it("a still-colliding choice nudges instead of clearing", () => {
    render(<Harness initial={stateAt("hash-design")} />)
    // Length only keeps everything in one bin; checking it nudges.
    fireEvent.click(screen.getByRole("button", { name: "Length only" }))
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    expect(screen.getByText(/Use a rule that reads the whole key/)).toBeInTheDocument()
  })
})

/** The tap-mode bucket buttons, in bin order (they alone carry aria-pressed). */
function binButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"))
}

/** Tap a bin by index and commit (the de-cued lookup flow: hash, choose, check). */
function commitBin(container: HTMLElement, index: number) {
  fireEvent.click(binButtons(container)[index])
  fireEvent.click(screen.getByRole("button", { name: "Check" }))
}

describe("lookup de-cue (sealed bins, several occupied)", () => {
  it("seals several bins at idle and hides the asked bin's contents until commit", () => {
    const { container } = render(<Harness initial={stateAt("lookup-found")} />)
    // (a) More than one bin is sealed-occupied, so the target is not "the only
    // non-empty bin".
    expect(screen.getAllByTestId("sealed-bucket").length).toBeGreaterThan(1)
    // (b) The asked bin's contents are NOT readable at idle (only `fox`, the key
    // being hashed, is visible in the box, never owl/ant sitting in its bin).
    expect(screen.queryByText("owl")).toBeNull()
    expect(screen.queryByText("ant")).toBeNull()

    commitBin(container, 0) // hash fox -> bin 0, tap it, check

    // Post-commit the bins unseal and the real chain shows.
    expect(screen.queryAllByTestId("sealed-bucket").length).toBe(0)
    expect(screen.getByText("owl")).toBeInTheDocument()
    expect(screen.getByText("ant")).toBeInTheDocument()
  })

  it("absent: also seals several bins and hides the decoy contents at idle", () => {
    render(<Harness initial={stateAt("lookup-absent")} />)
    expect(screen.getAllByTestId("sealed-bucket").length).toBeGreaterThan(1)
    expect(screen.queryByText("elk")).toBeNull() // the decoy in bat's bin
    expect(screen.queryByText("dog")).toBeNull() // a decoy elsewhere
  })
})

describe("lookup trace (revealed only after commit)", () => {
  it("offers no trace at idle, then walks the chain to the hit post-commit", () => {
    const { container } = render(<Harness initial={stateAt("lookup-found")} />)
    // Sealed: no trace until the learner has chosen a bin.
    expect(screen.queryByRole("button", { name: "Scan the bin" })).toBeNull()

    commitBin(container, 0)

    fireEvent.click(traceBtn()) // check owl
    expect(screen.getByText("checking owl")).toBeInTheDocument()
    fireEvent.click(traceBtn()) // check fox -> found
    expect(
      screen.getByText("checking owl, checking fox, found fox in bin 0"),
    ).toBeInTheDocument()
    expect(document.querySelector("[aria-current='step']")?.textContent).toContain("fox")
    expect(traceBtn()).toBeDisabled()
  })

  it("an absent lookup ends with 'absent' after commit", () => {
    const { container } = render(<Harness initial={stateAt("lookup-absent")} />)
    expect(screen.queryByRole("button", { name: "Scan the bin" })).toBeNull()
    commitBin(container, 3) // hash bat -> bin 3, tap it, check
    fireEvent.click(traceBtn())
    expect(screen.getByText(/not in bin 3, absent/)).toBeInTheDocument()
    expect(traceBtn()).toBeDisabled()
  })

  it("does not offer the scan on a non-lookup tap beat (hash-cat-again)", () => {
    render(<Harness initial={stateAt("hash-cat-again", { hash: 1 })} />)
    expect(screen.queryByRole("button", { name: "Scan the bin" })).toBeNull()
  })
})
