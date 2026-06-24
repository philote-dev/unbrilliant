import { describe, it, expect } from "vitest"

import { T_BAL, T_STICK, T_ZIG, inorder, type TreeNode } from "@/features/lesson/treesEngine"
import { compactLayout, straighten, tidyLayout } from "./treeLayout"

/**
 * Pure layout math. jsdom zeroes getBoundingClientRect, so the geometry that
 * makes the sequence beats un-readable as a row (and animates them back to
 * sorted) is proven here in node, not the figure. Grading never touches layout
 * (the engine grades off `inorder`), so these only assert the visual contract.
 */

/** Node ids paired with each node's local left/right children, depth-first. */
function eachParent(root: TreeNode, fn: (node: TreeNode) => void): void {
  fn(root)
  if (root.left) eachParent(root.left, fn)
  if (root.right) eachParent(root.right, fn)
}

describe("tidyLayout — x is the in-order index", () => {
  it("orders nodes left→right exactly by in-order (T_BAL)", () => {
    const { pos } = tidyLayout(T_BAL)
    const xs = inorder(T_BAL).map((id) => pos.get(id)!.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b)) // strictly increasing
    expect(new Set(xs).size).toBe(xs.length) // distinct columns
  })

  it("draws the degenerate stick as a descending staircase", () => {
    const { pos } = tidyLayout(T_STICK)
    const ids = inorder(T_STICK)
    // x rises with in-order AND y rises with depth — a diagonal (a list as a tree).
    const xs = ids.map((id) => pos.get(id)!.x)
    const ys = ids.map((id) => pos.get(id)!.y)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })
})

describe("compactLayout — non-monotonic, but locally correct", () => {
  it("scrambles global pixel-x away from in-order (T_BAL)", () => {
    const { pos } = compactLayout(T_BAL)
    const xs = inorder(T_BAL).map((id) => pos.get(id)!.x)
    expect(xs).not.toEqual([...xs].sort((a, b) => a - b)) // NOT readable as a row
  })

  it("scrambles global pixel-x away from in-order (T_ZIG)", () => {
    const { pos } = compactLayout(T_ZIG)
    const xs = inorder(T_ZIG).map((id) => pos.get(id)!.x)
    expect(xs).not.toEqual([...xs].sort((a, b) => a - b))
  })

  it("keeps every child on the correct local side of its parent", () => {
    for (const tree of [T_BAL, T_ZIG, T_STICK]) {
      const { pos } = compactLayout(tree)
      eachParent(tree, (node) => {
        const x = pos.get(node.id)!.x
        if (node.left) expect(pos.get(node.left.id)!.x).toBeLessThan(x)
        if (node.right) expect(pos.get(node.right.id)!.x).toBeGreaterThan(x)
      })
    }
  })

  it("places deeper nodes on lower rows", () => {
    const { pos } = compactLayout(T_ZIG)
    // 9 (root) above 3 (depth 1) above 7 (depth 2) above 5 (depth 3)
    expect(pos.get("n9")!.y).toBeLessThan(pos.get("n3")!.y)
    expect(pos.get("n3")!.y).toBeLessThan(pos.get("n7")!.y)
    expect(pos.get("n7")!.y).toBeLessThan(pos.get("n5")!.y)
  })
})

describe("straighten — compact → tidy", () => {
  it("interpolation endpoints equal the two layouts", () => {
    const compact = compactLayout(T_BAL)
    const tidy = tidyLayout(T_BAL)

    const at0 = straighten(0, compact, tidy)
    const at1 = straighten(1, compact, tidy)
    for (const id of inorder(T_BAL)) {
      expect(at0.get(id)!.x).toBeCloseTo(compact.pos.get(id)!.x)
      expect(at1.get(id)!.x).toBeCloseTo(tidy.pos.get(id)!.x)
      expect(at1.get(id)!.y).toBeCloseTo(tidy.pos.get(id)!.y)
    }
  })

  it("at t=1 the row is sorted by x (the order has assembled itself)", () => {
    const compact = compactLayout(T_ZIG)
    const tidy = tidyLayout(T_ZIG)
    const at1 = straighten(1, compact, tidy)
    const xs = inorder(T_ZIG).map((id) => at1.get(id)!.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })
})
