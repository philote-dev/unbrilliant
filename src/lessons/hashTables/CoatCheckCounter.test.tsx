import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import { RewireSurface } from "@/components/rewire/RewireSurface"
import {
  BUCKET_COUNT,
  bucketOf,
  bucketTargetId,
  keySum,
  type HashQuestion,
} from "@/features/lesson/hashTablesEngine"
import { CoatCheckCounter } from "./CoatCheckCounter"

/**
 * The cloakroom figure. jsdom can't measure geometry, so these cover what it
 * CAN: that the hung coats are a pure function of props, that the new coat rests
 * on the learner's CHOSEN hook (never the correct one) until confirmed, that
 * reduced motion shows the end-state, and that the e2e tracer hooks survive.
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

function coatQuestion(
  key: string,
  table: Record<number, string[]> = {},
): HashQuestion {
  return {
    kind: "realworld",
    bin: "lookup",
    mode: "drag",
    prompt: "",
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket: bucketOf(key),
    table,
    options: [],
    answer: bucketTargetId(bucketOf(key)),
    present: false,
    skin: "coatcheck",
    cost: { word: "free", count: 1, unit: "jump to the hook" },
    scanCost: null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

const LEGAL = new Set(
  Array.from({ length: BUCKET_COUNT }, (_, i) => bucketTargetId(i)),
)

function renderCounter(props: Parameters<typeof CoatCheckCounter>[0]) {
  return render(
    <RewireSurface legalTargets={LEGAL} onRewire={() => {}}>
      <CoatCheckCounter {...props} />
    </RewireSurface>,
  )
}

const hook = (container: HTMLElement, i: number): HTMLElement =>
  container.querySelector(`[data-rewire-target="${bucketTargetId(i)}"]`) as HTMLElement

describe("CoatCheckCounter: contents are pure from props", () => {
  it("hangs the pre-placed coats from the table prop (and nothing more, unplaced)", () => {
    // ivy → bucket 1; sam pre-hung on hook 3.
    renderCounter({ question: coatQuestion("ivy", { 3: ["sam"] }) })
    expect(screen.getByText("Sam")).toBeInTheDocument() // hung from props
    // The new coat isn't on any hook yet (only the ticket shows "Ivy's …").
    expect(screen.queryByText("Ivy")).toBeNull()
  })

  it("an empty table hangs no coats (purity)", () => {
    renderCounter({ question: coatQuestion("ivy", {}) })
    expect(screen.queryByText("Sam")).toBeNull()
  })

  it("rests the new coat on the CHOSEN hook, never the correct one, until checked", () => {
    const q = coatQuestion("ivy", { 3: ["sam"] }) // correct hook = 1
    const { container } = renderCounter({ question: q, placedBucket: 4 })
    // The coat hangs on hook 4 (the learner's pick), not on the correct hook 1.
    expect(hook(container, 4).textContent).toContain("Ivy")
    expect(hook(container, 1).textContent).not.toContain("Ivy")
  })

  it("settles the coat on its true hook once confirmed", () => {
    const q = coatQuestion("ivy", { 3: ["sam"] })
    const { container } = renderCounter({ question: q, placedBucket: 1, confirmed: true })
    expect(hook(container, 1).textContent).toContain("Ivy")
  })
})

describe("CoatCheckCounter: reduced motion + tracer hooks", () => {
  it("renders the coat at its end-state under reduced motion", () => {
    const { container } = renderCounter({
      question: coatQuestion("ivy", {}),
      placedBucket: 1,
      confirmed: true,
      reducedMotion: true,
    })
    expect(container.querySelector("[data-reduced-motion='1']")).not.toBeNull()
    expect(screen.getByText("Ivy")).toBeInTheDocument() // present, at rest
  })

  it("exposes the source, the bucket targets, and exactly one correct-bucket hook", () => {
    const { container } = renderCounter({ question: coatQuestion("ivy", { 3: ["sam"] }) })

    // the draggable ticket
    expect(container.querySelector("[data-rewire-source]")).not.toBeNull()

    // a drop target per hook, named bucket-0 … bucket-(B-1)
    for (let i = 0; i < BUCKET_COUNT; i++) {
      expect(container.querySelector(`[data-rewire-target="${bucketTargetId(i)}"]`)).not.toBeNull()
    }

    // exactly one correct-bucket tracer hook, pointing at ivy's bucket (1)
    const correct = container.querySelectorAll("[data-hash-correct-bucket]")
    expect(correct).toHaveLength(1)
    expect(correct[0].getAttribute("data-hash-correct-bucket")).toBe(bucketTargetId(bucketOf("ivy")))
  })
})
