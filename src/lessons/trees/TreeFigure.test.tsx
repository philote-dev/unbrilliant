import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"
import { render, fireEvent, within } from "@testing-library/react"

import type { LessonAction } from "@/features/lesson/engine"
import {
  T_BAL,
  createTrees,
  currentPartTrees,
  inorder,
  treesReducer,
  type TreesPart,
  type TreesState,
} from "@/features/lesson/treesEngine"
import { DisplayTree, TreeFigure } from "./TreeFigure"

/**
 * DOM tests for the figure. jsdom can't measure geometry (zeroed rects), but the
 * layout is pure, so the buttons render regardless. These cover what matters: the
 * "no jumping" tappable set (only the cursor's children + ghosts), the sequence
 * tap intent, the DEV tracer hooks, and the reduced-motion snap.
 */

function setReducedMotion(matches: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

beforeAll(() => setReducedMotion(false))
afterEach(() => setReducedMotion(false))

const run = (s: TreesState, ...actions: LessonAction[]) => actions.reduce(treesReducer, s)
const cont = (s: TreesState) => run(s, { type: "continue" })

/** Clear the current graded beat and advance (mirrors the engine driver). */
function clear(s: TreesState): TreesState {
  const q = s.question!
  let r = s
  const descend = (ghost: boolean) => {
    const d = q.descend!
    for (let i = 1; i < d.path.length; i++) r = run(r, { type: "select", letter: d.path[i] })
    if (ghost && d.missingSide) r = run(r, { type: "select", letter: `ghost:${d.missingSide}` })
  }
  switch (q.kind) {
    case "find-hit":
    case "realworld":
      descend(false)
      r = run(r, { type: "check" })
      break
    case "find-miss":
    case "insert":
      descend(true)
      r = run(r, { type: "check" })
      break
    case "sequence-a":
    case "sequence-b":
      for (const id of q.order) r = run(r, { type: "select", letter: id })
      r = run(r, { type: "check" })
      break
    case "compare-shape":
      r = run(r, { type: "select", letter: q.answer }, { type: "check" })
      break
    case "contrast-list":
      for (let i = 0; i < q.chainTargetIndex; i++) r = run(r, { type: "select", letter: "chain" })
      for (let i = 1; i < q.descend!.path.length; i++) r = run(r, { type: "select", letter: q.descend!.path[i] })
      r = run(r, { type: "check" })
      break
  }
  return run(r, { type: "next" })
}

function atPart(target: TreesPart): TreesState {
  let s = createTrees(1)
  let guard = 0
  while (currentPartTrees(s) !== target && guard++ < 40) {
    const p = currentPartTrees(s)
    s = p === "demo" || p === "teach-descend" || p === "teach-inorder" ? cont(s) : clear(s)
  }
  return s
}

describe("TreeFigure — descend", () => {
  it("makes only the cursor's two children tappable (no jumping)", () => {
    const s = atPart("find-hit") // cursor = root n8
    const { container } = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    const tappable = [...container.querySelectorAll("[data-tappable]")].map((el) =>
      el.getAttribute("data-node-id"),
    )
    expect(tappable.sort()).toEqual(["n12", "n4"])
  })

  it("stamps data-answer on the single correct next step", () => {
    const s = atPart("find-hit") // descend 10: n8 → n12 → n10
    const { container } = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(container.querySelector('[data-node-id="n12"]')).toHaveAttribute("data-answer", "1")
    expect(container.querySelector('[data-node-id="n4"]')).not.toHaveAttribute("data-answer")
  })

  it("dispatches a select with the tapped child id", () => {
    const dispatch = vi.fn()
    const s = atPart("find-hit")
    const { container } = render(<TreeFigure state={s} dispatch={dispatch} />)
    fireEvent.click(container.querySelector('[data-node-id="n12"]')!)
    expect(dispatch).toHaveBeenCalledWith({ type: "select", letter: "n12" })
  })

  it("shows dashed ghost slots at a leaf, with data-answer on the correct side", () => {
    // find-miss: descend 7 → n8 → n4 → n6, then n6 is a leaf (both sides empty)
    let s = atPart("find-miss")
    s = run(s, { type: "select", letter: "n4" }, { type: "select", letter: "n6" })
    const { container } = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    const ghosts = [...container.querySelectorAll("[data-ghost-side]")].map((el) =>
      el.getAttribute("data-ghost-side"),
    )
    expect(ghosts.sort()).toEqual(["left", "right"])
    expect(container.querySelector('[data-ghost-side="right"]')).toHaveAttribute("data-answer", "1")
    expect(container.querySelector('[data-ghost-side="left"]')).not.toHaveAttribute("data-answer")
  })

  it("snaps (no drift) when reduced motion is requested", () => {
    const s = atPart("find-hit")
    const { getByTestId } = render(<TreeFigure state={s} dispatch={vi.fn()} reducedMotion />)
    expect(getByTestId("tree-figure")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("drops every ghost once a slot is committed (no overlap with the filled slot)", () => {
    // find-miss: descend 7 → n8 → n4 → n6, a leaf with both sides empty.
    let s = atPart("find-miss")
    s = run(s, { type: "select", letter: "n4" }, { type: "select", letter: "n6" })
    const before = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(before.container.querySelectorAll("[data-ghost-side]")).toHaveLength(2)
    before.unmount()

    // Commit the correct (right) ghost: every ghost vanishes; the filled slot (7) stands in.
    s = run(s, { type: "select", letter: "ghost:right" })
    const after = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(after.container.querySelectorAll("[data-ghost-side]")).toHaveLength(0)
    expect(after.container).toHaveTextContent("7") // the committed slot, not a tree key
  })
})

describe("TreeFigure: straighten payoff", () => {
  it("straightens the sequence layout on a correct in-order tap (data-straightened)", () => {
    let s = atPart("sequence-a")
    const idle = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(idle.getByTestId("tree-figure")).toHaveAttribute("data-straightened", "0")
    idle.unmount()

    for (const id of s.question!.order) s = run(s, { type: "select", letter: id })
    s = run(s, { type: "check" })
    expect(s.feedback).toBe("correct")
    const done = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(done.getByTestId("tree-figure")).toHaveAttribute("data-straightened", "1")
  })

  it("also straightens on Why after a fail (the answer is shown)", () => {
    let s = atPart("sequence-a")
    const order = s.question!.order
    const swapped = [order[1], order[0], ...order.slice(2)]
    for (const id of swapped) s = run(s, { type: "select", letter: id })
    s = run(s, { type: "check" }, { type: "check" }, { type: "reveal" })
    expect(s.feedback).toBe("fail")
    const { getByTestId } = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(getByTestId("tree-figure")).toHaveAttribute("data-straightened", "1")
  })
})

describe("DisplayTree: in-order ranks (teach-inorder order)", () => {
  it("badges every node with its 1..n visit order so left → node → right is visible", () => {
    const { container } = render(<DisplayTree tree={T_BAL} orderRanks={inorder(T_BAL)} />)
    // inorder = n2,n4,n6,n8,n10,n12,n14 → the root (n8) is visited 4th, after its left subtree.
    expect(container.querySelector('[data-node-id="n2"]')).toHaveAttribute("data-order-rank", "1")
    expect(container.querySelector('[data-node-id="n8"]')).toHaveAttribute("data-order-rank", "4")
    expect(container.querySelector('[data-node-id="n14"]')).toHaveAttribute("data-order-rank", "7")
  })

  it("omits rank badges when no order is given (descend / compare reuse)", () => {
    const { container } = render(<DisplayTree tree={T_BAL} />)
    expect(container.querySelector("[data-order-rank]")).toBeNull()
  })
})

describe("TreeFigure — sequence", () => {
  it("makes every node tappable and stamps its in-order rank", () => {
    const s = atPart("sequence-a") // T_BAL, inorder n2,n4,n6,n8,n10,n12,n14
    const { container } = render(<TreeFigure state={s} dispatch={vi.fn()} />)
    expect(container.querySelectorAll("[data-tappable]").length).toBe(7)
    expect(container.querySelector('[data-node-id="n2"]')).toHaveAttribute("data-inorder-rank", "0")
    expect(container.querySelector('[data-node-id="n8"]')).toHaveAttribute("data-inorder-rank", "3")
    expect(container.querySelector('[data-node-id="n14"]')).toHaveAttribute("data-inorder-rank", "6")
  })

  it("dispatches a select for the tapped node, and locks tapped nodes", () => {
    const dispatch = vi.fn()
    let s = atPart("sequence-a")
    s = run(s, { type: "select", letter: "n2" }) // tap the in-order first node
    const { container } = render(<TreeFigure state={s} dispatch={dispatch} />)
    // n2 is now committed (shows its order badge, no longer a tappable button)
    expect(container.querySelector('button[data-node-id="n2"]')).toBeNull()
    fireEvent.click(container.querySelector('button[data-node-id="n4"]')!)
    expect(dispatch).toHaveBeenCalledWith({ type: "select", letter: "n4" })
  })
})

describe("TreeFigure halving meter", () => {
  const onPips = (els: HTMLElement[]) => els.filter((e) => e.getAttribute("data-on") === "1")

  it("renders the search-space meter and keeps the SR status in agreement", () => {
    const s0 = atPart("find-hit") // target 10, cursor at the root n8
    const { container, getByTestId, rerender } = render(
      <TreeFigure state={s0} dispatch={vi.fn()} />,
    )
    const meter = getByTestId("halving-meter")
    const pips = within(meter).getAllByTestId("halving-pip")
    expect(pips).toHaveLength(7) // total = subtreeSize(tree)
    expect(onPips(pips)).toHaveLength(7) // whole tree in play at the root
    expect(meter).toHaveTextContent("7 in play")
    expect(container.querySelector('[role="status"]')).toHaveTextContent("7 nodes in play")

    // Step to n12 → 3 in play; the meter and the SR line report the same number.
    const s1 = run(s0, { type: "select", letter: "n12" })
    rerender(<TreeFigure state={s1} dispatch={vi.fn()} />)
    expect(onPips(within(getByTestId("halving-meter")).getAllByTestId("halving-pip"))).toHaveLength(3)
    expect(getByTestId("halving-meter")).toHaveTextContent("3 in play")
    expect(container.querySelector('[role="status"]')).toHaveTextContent("3 nodes in play")
  })
})
