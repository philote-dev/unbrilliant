import { describe, it, expect, beforeAll } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { T_BAL, descendPath, inorderKeys } from "@/features/lesson/treesEngine"
import { ContrastRace } from "./ContrastRace"

/**
 * The post-correct reveal replay: a read-only Back/Next/Replay race between a
 * sorted-list walk and a BST descend. jsdom can't measure geometry, but the
 * stepper, the dropped-subtree greying, and the SR status are all pure, so these
 * cover what matters.
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

const chain = inorderKeys(T_BAL) // [2, 4, 6, 8, 10, 12, 14]
const TARGET = 14
const chainTargetIndex = chain.indexOf(TARGET) // 6
const path = descendPath(T_BAL, TARGET).path // ["n8", "n12", "n14"]

function setup(extra: { reducedMotion?: boolean } = {}) {
  return render(
    <ContrastRace
      chain={chain}
      chainTargetIndex={chainTargetIndex}
      tree={T_BAL}
      path={path}
      {...extra}
    />,
  )
}

const raceStatus = () => screen.getByText(/Tree found/)

describe("ContrastRace", () => {
  it("starts at step 0: tree result stated, list at the first hop", () => {
    setup()
    expect(raceStatus()).toHaveTextContent(
      "Tree found 14 in 3 comparisons; list at hop 1 of 7.",
    )
    expect(screen.getByText(/Step 0 \/ 6/)).toBeInTheDocument()
  })

  it("Next advances both: list cursor + tree lit path, greying the dropped subtree", () => {
    const { container } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(raceStatus()).toHaveTextContent("list at hop 2 of 7")
    // step 1 lights n8 -> n12 and greys the discarded left subtree (n2, n4, n6).
    for (const id of ["n2", "n4", "n6"]) {
      expect(container.querySelector(`[data-node-id="${id}"]`)).toHaveAttribute("data-dropped", "1")
    }
    expect(container.querySelector('[data-node-id="n12"]')).not.toHaveAttribute("data-dropped")
    expect(container.querySelector('[data-node-id="n14"]')).not.toHaveAttribute("data-dropped")
  })

  it("Back is disabled at the start, Next disabled at the end, Replay resets", () => {
    setup()
    const back = screen.getByRole("button", { name: "Back" })
    const next = screen.getByRole("button", { name: "Next" })
    expect(back).toBeDisabled()
    for (let i = 0; i < 6; i++) fireEvent.click(next) // walk to the end
    expect(next).toBeDisabled()
    expect(raceStatus()).toHaveTextContent("list at hop 7 of 7")
    fireEvent.click(screen.getByRole("button", { name: "Replay" }))
    expect(screen.getByText(/Step 0 \/ 6/)).toBeInTheDocument()
    expect(raceStatus()).toHaveTextContent("list at hop 1 of 7")
  })

  it("reduced motion starts at the fully-revealed end-state", () => {
    setup({ reducedMotion: true })
    expect(screen.getByTestId("contrast-race")).toHaveAttribute("data-reduced-motion", "1")
    expect(screen.getByText(/Step 6 \/ 6/)).toBeInTheDocument()
    expect(raceStatus()).toHaveTextContent("list at hop 7 of 7")
  })

  it("the replay controls are large tap targets (size default = 44px)", () => {
    setup()
    for (const name of ["Back", "Next", "Replay"]) {
      expect(screen.getByRole("button", { name }).getAttribute("data-size")).toBe("default")
    }
  })

  it("the read-only list shows no live walk button (cursor alone shows progress)", () => {
    setup()
    // SortedChain's interactive "walk to N" button only appears with onAdvance.
    expect(screen.queryByRole("button", { name: /walk to/ })).toBeNull()
  })
})
