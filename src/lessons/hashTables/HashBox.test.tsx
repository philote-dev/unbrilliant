import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import {
  bucketOf,
  keySum,
  type HashQuestion,
} from "@/features/lesson/hashTablesEngine"
import { HashBox } from "./HashBox"

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

/** Step the letter-by-letter box to completion (or until the control vanishes). */
function addAllLetters() {
  let step = screen.queryByRole("button", { name: /Add (the|next) letter/ })
  let guard = 0
  while (step && guard++ < 10) {
    fireEvent.click(step)
    step = screen.queryByRole("button", { name: /Add (the|next) letter/ })
  }
}

function tapQuestion(key: string): HashQuestion {
  return {
    kind: "lookup-found",
    bin: "lookup",
    mode: "tap",
    prompt: "",
    key,
    bucketCount: 5,
    sum: keySum(key),
    bucket: bucketOf(key),
    table: {},
    options: [],
    answer: `bucket-${bucketOf(key)}`,
    present: true,
    contacts: false,
    cost: null,
    scanCost: null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

describe("HashBox", () => {
  it("steps through the letters, revealing the running sum but never the bucket", () => {
    render(<HashBox question={tapQuestion("cat")} />)

    // The key's letters render; values are hidden until the learner steps.
    expect(screen.getByText("c")).toBeInTheDocument()
    expect(screen.getAllByText("·").length).toBe(3)

    // Run the box letter by letter.
    addAllLetters()

    // The full sum (cat = 24) is revealed; the bucket is withheld — the box
    // scaffolds the sum, never the `mod` result (the learner supplies that).
    expect(screen.getAllByText("24").length).toBeGreaterThan(0)
    expect(screen.getByText("?")).toBeInTheDocument()
  })

  it("a graded beat keeps withholding the bucket even after the sum is revealed", () => {
    render(<HashBox question={tapQuestion("cat")} />)
    addAllLetters()
    // No reveal prop → still "?", and no fly animation.
    expect(screen.getByText("?")).toBeInTheDocument()
    expect(screen.queryByTestId("hash-fly")).toBeNull()
  })

  it("the DEMO beat reveals the bucket arithmetic and flies the key once summed", () => {
    render(<HashBox question={tapQuestion("cat")} revealBucket />)

    // Before stepping, the bucket is still withheld (the mod isn't done yet).
    expect(screen.getByText("?")).toBeInTheDocument()
    expect(screen.queryByTestId("hash-fly")).toBeNull()

    addAllLetters()

    // cat → 24 mod 5 = 4: the "?" is replaced and the key flies to its bucket.
    expect(screen.queryByText("?")).toBeNull()
    expect(screen.getByText("bucket 4")).toBeInTheDocument()
    expect(screen.getByTestId("hash-fly")).toBeInTheDocument()
  })

  it("offers no draggable key in tap mode (no rewire source)", () => {
    const { container } = render(<HashBox question={tapQuestion("dog")} />)
    expect(container.querySelector("[data-rewire-source]")).toBeNull()
    expect(screen.getByText(/Tap the bucket it lands in/)).toBeInTheDocument()
  })
})
