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
import { itemFor } from "./warehouseData"
import { WarehouseShelf } from "./WarehouseShelf"

/**
 * The warehouse stow figure. jsdom can't measure geometry, so these cover what it
 * CAN: that the stowed items are a pure function of props, that the inbound
 * package rests on the bin the learner CHOSE (never the correct one) until
 * confirmed, that reduced motion shows the end-state, and that the e2e tracer
 * hooks survive (source, bin targets, exactly one correct-bin hook).
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

function stowQuestion(key: string, table: Record<number, string[]> = {}): HashQuestion {
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
    skin: "warehouse",
    cost: { word: "free", count: 1, unit: "jump to the bin" },
    scanCost: null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

const LEGAL = new Set(Array.from({ length: BUCKET_COUNT }, (_, i) => bucketTargetId(i)))

function renderShelf(props: Parameters<typeof WarehouseShelf>[0]) {
  return render(
    <RewireSurface legalTargets={LEGAL} onRewire={() => {}}>
      <WarehouseShelf {...props} />
    </RewireSurface>,
  )
}

const bin = (container: HTMLElement, i: number): HTMLElement =>
  container.querySelector(`[data-rewire-target="${bucketTargetId(i)}"]`) as HTMLElement

const SKU = (key: string) => itemFor(key).sku

describe("WarehouseShelf: stowed items are pure from props", () => {
  it("shows the pre-stowed items from the table prop (and nothing more, unplaced)", () => {
    // ivy → bin 1; sam pre-stowed in bin 3.
    const { container } = renderShelf({ question: stowQuestion("ivy", { 3: ["sam"] }) })
    expect(bin(container, 3).textContent).toContain(SKU("sam")) // stowed from props
    // The inbound package isn't in any bin yet (it sits on the scanner).
    for (let i = 0; i < BUCKET_COUNT; i++) {
      expect(bin(container, i).textContent).not.toContain(SKU("ivy"))
    }
  })

  it("an empty table stows nothing in the bins (purity)", () => {
    const { container } = renderShelf({ question: stowQuestion("ivy", {}) })
    expect(bin(container, 3).textContent).not.toContain(SKU("sam"))
  })

  it("rests the package on the CHOSEN bin, never the correct one, until checked", () => {
    const q = stowQuestion("ivy", { 3: ["sam"] }) // correct bin = 1
    const { container } = renderShelf({ question: q, placedBucket: 4 })
    expect(bin(container, 4).textContent).toContain(SKU("ivy"))
    expect(bin(container, 1).textContent).not.toContain(SKU("ivy"))
  })

  it("settles the package in its true bin once confirmed", () => {
    const q = stowQuestion("ivy", { 3: ["sam"] })
    const { container } = renderShelf({ question: q, placedBucket: 1, confirmed: true })
    expect(bin(container, 1).textContent).toContain(SKU("ivy"))
  })
})

describe("WarehouseShelf: reduced motion + tracer hooks", () => {
  it("renders the package at its end-state under reduced motion", () => {
    const { container } = renderShelf({
      question: stowQuestion("ivy", {}),
      placedBucket: 1,
      confirmed: true,
      reducedMotion: true,
    })
    expect(container.querySelector("[data-reduced-motion='1']")).not.toBeNull()
    expect(bin(container, 1).textContent).toContain(SKU("ivy")) // present, at rest
  })

  it("exposes the source, the bin targets, and exactly one correct-bin hook", () => {
    const { container } = renderShelf({ question: stowQuestion("ivy", { 3: ["sam"] }) })

    expect(container.querySelector("[data-rewire-source]")).not.toBeNull()
    for (let i = 0; i < BUCKET_COUNT; i++) {
      expect(container.querySelector(`[data-rewire-target="${bucketTargetId(i)}"]`)).not.toBeNull()
    }
    const correct = container.querySelectorAll("[data-hash-correct-bucket]")
    expect(correct).toHaveLength(1)
    expect(correct[0].getAttribute("data-hash-correct-bucket")).toBe(bucketTargetId(bucketOf("ivy")))
  })
})

describe("warehouseData", () => {
  it("itemFor is deterministic for a given code", () => {
    expect(itemFor("ivy")).toEqual(itemFor("ivy"))
    expect(SKU("ivy")).toBe(`IVY-${keySum("ivy")}`)
  })
})
