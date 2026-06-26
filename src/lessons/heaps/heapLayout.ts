/**
 * Pure, shared geometry for the dual tree+array heap figure. No DOM, no React:
 * given a heap length it computes where each complete-tree node sits and how wide
 * the index-ruled array strip is. Lifted verbatim out of HeapDualView so the ER
 * triage skin (ERTriageBoard) can reuse the EXACT same layout, keeping the
 * tree<->array index map identical across both figures. Everything is 0-based and
 * deterministic, so it is unit-testable in node (jsdom zeroes getBoundingClientRect,
 * so the math must live here, not in the figure).
 *
 * Slot `i` sits at depth `floor(log2(i+1))`, position `i-(2^depth-1)` in its row.
 */

/** Tree drawing width (the SVG viewBox width the nodes are spread across). */
export const W = 320
/** Vertical distance between tree rows. */
export const ROW_H = 64
/** Top padding above the root row. */
export const PAD_TOP = 20
/** Tree node radius. */
export const NODE_R = 17
/** Array cell side (>=44px tap target). */
export const CELL = 44
/** Gap between array cells. */
export const GAP = 10
/** Height of the connector band drawn above the array strip. */
export const BAND_H = 30

export const depthOf = (i: number): number => Math.floor(Math.log2(i + 1))
export const rowStart = (depth: number): number => 2 ** depth - 1
export const colsInRow = (depth: number): number => 2 ** depth
/** Horizontal fraction (0..1) of slot `i` within the complete-tree layout. */
export const xFracOf = (i: number): number => {
  const d = depthOf(i)
  return (i - rowStart(d) + 0.5) / colsInRow(d)
}

export interface NodeGeom {
  i: number
  cx: number
  cy: number
}

/** Number of tree rows needed for `n` slots. */
export const treeRows = (n: number): number => (n > 0 ? depthOf(n - 1) + 1 : 1)

/**
 * Optional overrides for a tighter ("compact") tree: a smaller row pitch, top pad,
 * and node radius, used by the reference figure on predict beats so the answer
 * cards sit higher. Omitting them reproduces the standard layout exactly, so
 * existing callers (and the ER triage board) are untouched.
 */
export interface TreeLayoutOpts {
  rowH?: number
  padTop?: number
  nodeR?: number
}

/** SVG height needed to draw the tree for `n` slots. */
export const treeHeight = (n: number, opts: TreeLayoutOpts = {}): number => {
  const { rowH = ROW_H, padTop = PAD_TOP } = opts
  return padTop + treeRows(n) * rowH + 6
}
/** Center positions for every node of an `n`-slot complete tree. */
export const nodePositions = (n: number, opts: TreeLayoutOpts = {}): NodeGeom[] => {
  const { rowH = ROW_H, padTop = PAD_TOP, nodeR = NODE_R } = opts
  return Array.from({ length: n }, (_, i) => ({
    i,
    cx: xFracOf(i) * W,
    cy: padTop + depthOf(i) * rowH + nodeR,
  }))
}

/** Natural pixel width of the `n`-cell array strip (before any fit guard). */
export const arrayRowWidth = (n: number): number => n * CELL + Math.max(0, n - 1) * GAP
/** Horizontal center of array cell `i` within the strip. */
export const cellCenter = (i: number): number => i * (CELL + GAP) + CELL / 2
