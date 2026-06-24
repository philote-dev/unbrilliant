import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import { BucketChain } from "./BucketChain"
import { HashTable } from "./HashTable"

/**
 * The bucket-chain figure. The default render must stay byte-compatible with the
 * pre-enhancement markup; the new props (trace cursor, found flag, tail-join,
 * reduced motion) layer affordances on top without disturbing no-prop callers.
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

/** The bordered node boxes of a chain (spans carrying the border-2 token). */
function nodeBoxes(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("span")).filter((s) =>
    s.className.includes("border-2"),
  )
}

describe("BucketChain: default render is unchanged", () => {
  it("renders nodes as bordered boxes joined by arrows, no extra affordances", () => {
    const { container } = render(<BucketChain chain={["owl", "fox"]} />)
    const boxes = nodeBoxes(container)
    expect(boxes).toHaveLength(2)
    expect(boxes[0].textContent).toBe("owl")
    expect(boxes[1].textContent).toBe("fox")
    for (const b of boxes) {
      expect(b.className).toContain("border-border")
      expect(b.className).toContain("bg-card")
      expect(b.className).not.toContain("gap-1")
      expect(b.getAttribute("aria-current")).toBeNull()
    }
    expect(container.querySelectorAll("svg")).toHaveLength(1) // one connector arrow
    expect(container.querySelector(".sr-only")).toBeNull()
  })

  it("highlightLast lilac-tints only the tail (today's behavior)", () => {
    const { container } = render(<BucketChain chain={["cat", "sun"]} highlightLast />)
    const boxes = nodeBoxes(container)
    expect(boxes[0].className).toContain("border-border")
    expect(boxes[1].className).toContain("border-lilac-strong")
    expect(boxes[1].className).toContain("bg-lilac-soft")
  })

  it("an empty chain still reads 'empty'", () => {
    render(<BucketChain chain={[]} />)
    expect(screen.getByText("empty")).toBeInTheDocument()
  })
})

describe("BucketChain: trace + append affordances", () => {
  it("activeIndex marks the checked node aria-current='step' with a lilac ring", () => {
    const { container } = render(<BucketChain chain={["owl", "fox", "ant"]} activeIndex={1} />)
    const boxes = nodeBoxes(container)
    expect(boxes[1].getAttribute("aria-current")).toBe("step")
    expect(boxes[1].className).toContain("border-lilac-strong")
    expect(boxes[1].className).toContain("ring-2")
    expect(boxes[0].getAttribute("aria-current")).toBeNull()
    expect(boxes[2].getAttribute("aria-current")).toBeNull()
  })

  it("foundIndex flags the matched node with an icon + SR-only 'found' (not color alone)", () => {
    const { container } = render(<BucketChain chain={["owl", "fox", "ant"]} foundIndex={1} />)
    const boxes = nodeBoxes(container)
    expect(boxes[1].className).toContain("border-success")
    expect(boxes[1].querySelector("svg")).not.toBeNull() // the check icon
    expect(boxes[1].querySelector(".sr-only")?.textContent).toContain("found")
    expect(boxes[1].textContent).toContain("fox")
  })

  it("enterTail + reducedMotion snaps the tail straight to its end-state", () => {
    const { container } = render(
      <BucketChain chain={["cat", "sun"]} enterTail reducedMotion />,
    )
    const boxes = nodeBoxes(container)
    expect(boxes[boxes.length - 1].textContent).toBe("sun") // end-state visible
  })
})

describe("HashTable: reduced motion + bucket-chain forwarding", () => {
  // NOTE: motion caches the reduced-motion preference in a module-level singleton
  // seeded on the first useReducedMotion call, so this must be the first HashTable
  // render in the file (BucketChain itself takes reducedMotion as a prop and never
  // touches the singleton). The allowed-motion default is covered by every other
  // dom test in the suite, where the singleton stays false.
  it("sets data-reduced-motion on the root when motion is reduced", () => {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: /reduce/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
    const { container } = render(
      <HashTable bucketCount={5} table={{ 0: ["owl", "fox"] }} mode="display" />,
    )
    expect(container.querySelector("[data-reduced-motion='1']")).not.toBeNull()
  })

  it("forwards the trace cursor + found flag to the searched bucket's chain", () => {
    const { container } = render(
      <HashTable
        bucketCount={5}
        table={{ 0: ["owl", "fox", "ant"] }}
        mode="display"
        searchBucket={0}
        searchActiveIndex={1}
        foundIndex={1}
      />,
    )
    const active = container.querySelector("[aria-current='step']")
    expect(active?.textContent).toContain("fox")
    expect(container.querySelector(".sr-only")?.textContent).toContain("found")
  })
})
