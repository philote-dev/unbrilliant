import { inorder, type TreeNode } from "@/features/lesson/treesEngine"

/**
 * Pure, hand-rolled tree geometry — no DOM, no React, no `d3-hierarchy`. Owning
 * the x-coordinate is the whole point: it lets the SEQUENCE beats draw a
 * deliberately **compact, non-monotonic** layout (pixel-x ≠ in-order, so the
 * sorted order can't be read off the row) and then **straighten** that layout
 * into the tidy in-order positions during the Why-replay (each node slides from
 * its compact slot to its sorted x). Grading never touches this file — the engine
 * grades off `inorder` (`docs/lessons/trees-bst.md` Determinism), so a layout bug
 * can never change a verdict. jsdom zeroes `getBoundingClientRect`, so the math
 * lives here (node-tested), not in the figure.
 *
 * Two layouts share one rule — each child sits locally down-left / down-right of
 * its parent (`x(left) < x(node) < x(right)`):
 *  - `tidyLayout`   — `x = in-order index` → strictly sorted by x (readable; used
 *    for descend/teach where reading order doesn't matter, and as the straighten
 *    target).
 *  - `compactLayout`— `x` from a depth-weighted offset whose spread is NOT
 *    monotonically shrinking, so deep nodes cross over shallow ones: globally
 *    non-monotonic vs in-order, yet still locally correct (used for sequence).
 */

export interface NodePos {
  x: number
  y: number
}
export interface TreeLayout {
  /** Node id → its CENTER point. */
  pos: Map<string, NodePos>
  width: number
  height: number
}

/** Circular nodes (≥ 44px tap target), drawn as `rounded-full`. */
export const NODE_W = 46
export const NODE_H = 46
export const NODE_R = NODE_W / 2
export const MARGIN = 12
/** Center-to-center vertical gap between depth levels. */
export const ROW_Y = 76
/** Center-to-center horizontal gap between in-order columns (tidy). */
export const GAP_X = 52
/** Pixels per compact offset unit. */
export const COMPACT_UNIT = 30

/**
 * Per-level horizontal spread for the compact layout. It rises at depth 1 then
 * eases, so it is NOT monotonically shrinking — that non-monotonicity is exactly
 * what scrambles global pixel-x away from in-order while every child stays on the
 * correct local side of its parent.
 */
const SPREAD = [2, 3, 1.5, 0.9, 0.6]
function spreadAt(level: number): number {
  if (level < SPREAD.length) return SPREAD[level]
  return SPREAD[SPREAD.length - 1] * Math.pow(0.6, level - SPREAD.length + 1)
}

/** Each node's depth level from the root (root = 0). */
function levels(root: TreeNode): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (node: TreeNode | null, level: number) => {
    if (!node) return
    out.set(node.id, level)
    walk(node.left, level + 1)
    walk(node.right, level + 1)
  }
  walk(root, 0)
  return out
}

function maxLevel(levelMap: Map<string, number>): number {
  let m = 0
  for (const v of levelMap.values()) m = Math.max(m, v)
  return m
}

/** Tidy layout: `x = in-order index` (monotonic), `y = depth level`. */
export function tidyLayout(root: TreeNode): TreeLayout {
  const order = inorder(root)
  const level = levels(root)
  const pos = new Map<string, NodePos>()
  order.forEach((id, i) => {
    pos.set(id, {
      x: MARGIN + NODE_R + i * GAP_X,
      y: MARGIN + NODE_R + (level.get(id) ?? 0) * ROW_Y,
    })
  })
  return {
    pos,
    width: MARGIN * 2 + NODE_W + Math.max(0, order.length - 1) * GAP_X,
    height: MARGIN * 2 + NODE_H + maxLevel(level) * ROW_Y,
  }
}

/** Raw compact x (offset units, can be negative) per node id. */
function compactRaw(root: TreeNode): Map<string, number> {
  const raw = new Map<string, number>()
  const walk = (node: TreeNode | null, x: number, level: number) => {
    if (!node) return
    raw.set(node.id, x)
    const s = spreadAt(level)
    walk(node.left, x - s, level + 1)
    walk(node.right, x + s, level + 1)
  }
  walk(root, 0, 0)
  return raw
}

/**
 * Compact layout: the same depth-level `y`, but `x` from the non-monotonic
 * offset scheme — globally NOT sorted by in-order, while each child still sits
 * down-left / down-right of its parent.
 */
export function compactLayout(root: TreeNode): TreeLayout {
  const raw = compactRaw(root)
  const level = levels(root)
  let min = Infinity
  let max = -Infinity
  for (const v of raw.values()) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  const pos = new Map<string, NodePos>()
  for (const [id, rx] of raw) {
    pos.set(id, {
      x: MARGIN + NODE_R + (rx - min) * COMPACT_UNIT,
      y: MARGIN + NODE_R + (level.get(id) ?? 0) * ROW_Y,
    })
  }
  return {
    pos,
    width: MARGIN * 2 + NODE_W + (max - min) * COMPACT_UNIT,
    height: MARGIN * 2 + NODE_H + maxLevel(level) * ROW_Y,
  }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Interpolate from compact (t = 0) to tidy (t = 1): the Why-replay "straighten"
 * where each node slides to its sorted in-order x. Endpoints are exact — `t = 1`
 * equals the tidy positions, so the row visibly assembles into sorted order.
 */
export function straighten(t: number, compact: TreeLayout, tidy: TreeLayout): Map<string, NodePos> {
  const out = new Map<string, NodePos>()
  for (const [id, tidyPos] of tidy.pos) {
    const from = compact.pos.get(id) ?? tidyPos
    out.set(id, { x: lerp(from.x, tidyPos.x, t), y: lerp(from.y, tidyPos.y, t) })
  }
  return out
}
