/**
 * Pure geometry for the contiguous ArrayStrip: a row of cells that TOUCH (gap 0,
 * the load-bearing "contiguity" fact) over an address ruler rendered beneath.
 * No DOM, no React, every function deterministic, so the routing math is
 * unit-tested in node (jsdom zeroes getBoundingClientRect). The figure is a thin
 * shell that scales this intrinsic layout to fit its container.
 *
 * The read-mode access overlay is the O(1) jump: `jumpMarker(k, n)` is a halo
 * circle FIXED centered above the whole array, with a straight line reaching down
 * to cell k's top (the one direct lookup). The halo never moves; only the line's
 * far end follows the cell, so the end cells get the longest, most-angled lines.
 *
 * The O(n) value search is a hands-on walk (ArrayStrip `mode="scan"`), not an
 * overlay: `scanAnchor(i)` pins a marker above the cell where it began and
 * `scanReach(min, max)` grows a connector along the tops of the revealed run.
 * Plus the dynamic-array `capacitySlots` / `doubledLayout` for the grow figure.
 */

export interface Pt {
  x: number
  y: number
}
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Cells are squares that touch (no gap): contiguity is the visual fact. */
export const CELL = 46
export const GAP = 0
/** The address ruler sits beneath the row. */
export const RULER_GAP = 10
export const RULER_H = 22

/** Left→right contiguous cell box; cells share edges (x + CELL === next x). */
export function cellBox(i: number): Box {
  return { x: i * (CELL + GAP), y: 0, w: CELL, h: CELL }
}

export function cellX(i: number): number {
  return i * (CELL + GAP)
}

export function cellCenter(i: number): Pt {
  return { x: cellX(i) + CELL / 2, y: CELL / 2 }
}

/** The ruler tick for index i sits centered directly beneath cell i. */
export function rulerTickX(i: number): number {
  return cellX(i) + CELL / 2
}

/** Y of the ruler ticks (centerline of the ruler band). */
export const rulerY = CELL + RULER_GAP + RULER_H / 2

/** The intrinsic drawing surface for a row of n cells (+ the ruler band). */
export function stripExtent(n: number): { width: number; height: number } {
  return {
    width: Math.max(0, n) * (CELL + GAP) - (n > 0 ? GAP : 0),
    height: CELL + RULER_GAP + RULER_H,
  }
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/** The "jump" marker geometry: halo size and how far it floats above the array. */
export const JUMP_RADIUS = 8
export const JUMP_RISE = 84 // how far above the array top the fixed halo sits
export const JUMP_DROP = 22 // the short vertical drop out of the halo before turning
export const JUMP_CORNER = 9 // rounded-corner radius at the right-angle turns

/**
 * A single "jump" marker: a halo circle FIXED centered above the whole strip. The
 * halo position depends only on the strip size (n), never on the selection, so
 * only the connector route changes per cell. One direct lookup, no walking (the
 * O(1) picture). Coordinates are in the strip's space, where y = 0 is the top
 * edge of the cell row, so the halo sits at a negative y above the array.
 */
export function jumpMarker(
  k: number,
  n: number,
): {
  cell: Pt // top-center of cell k (where the lookup lands)
  circle: Pt & { r: number } // the fixed halo, centered above the array
} {
  const cell: Pt = { x: cellCenter(k).x, y: 0 }
  const circle = { x: stripExtent(n).width / 2, y: -JUMP_RISE, r: JUMP_RADIUS }
  return { cell, circle }
}

/**
 * The connector route from the fixed halo to a target cell top: a right-angle
 * (Manhattan) path that drops a little out of the halo, runs horizontally to the
 * cell's column, then drops into the cell. The two turns are rounded (quadratics),
 * so it reads like a tidy circuit trace. Returns the SVG `d` and the ordered
 * axis-aligned waypoints (pre-rounding) for testing/derivation. PURE.
 */
export function jumpPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { d: string; points: Pt[] } {
  const midY = fromY + JUMP_DROP
  const points: Pt[] = [
    { x: fromX, y: fromY },
    { x: fromX, y: midY },
    { x: toX, y: midY },
    { x: toX, y: toY },
  ]
  const s = Math.sign(toX - fromX)
  // Shrink the corner radius for very short horizontal runs so the rounded
  // turns never overshoot each other (keeps the path clean near the center).
  const r = Math.min(JUMP_CORNER, Math.abs(toX - fromX) / 2 || JUMP_CORNER)
  let d = `M ${r2(fromX)} ${r2(fromY)}`
  d += ` L ${r2(fromX)} ${r2(midY - r)}`
  d += ` Q ${r2(fromX)} ${r2(midY)} ${r2(fromX + s * r)} ${r2(midY)}`
  d += ` L ${r2(toX - s * r)} ${r2(midY)}`
  d += ` Q ${r2(toX)} ${r2(midY)} ${r2(toX)} ${r2(midY + r)}`
  d += ` L ${r2(toX)} ${r2(toY)}`
  return { d, points }
}

/* ------------------------------- scan walk ------------------------------- */

/** The reach line rides this far above the cell tops; the anchor dot floats higher. */
export const SCAN_REACH_RISE = 7
export const SCAN_ANCHOR_RISE = 34
export const SCAN_ANCHOR_RADIUS = 5

/**
 * The scan "reach": a thin connector riding just above the tops of the revealed
 * run [minIndex, maxIndex], from cell-top-center to cell-top-center lifted by
 * SCAN_REACH_RISE so it hugs the row. A single revealed cell is a zero-length
 * reach (the start, before any walk). PURE.
 */
export function scanReach(
  minIndex: number,
  maxIndex: number,
): { from: Pt; to: Pt; d: string } {
  const y = -SCAN_REACH_RISE
  const from: Pt = { x: cellCenter(minIndex).x, y }
  const to: Pt = { x: cellCenter(maxIndex).x, y }
  return { from, to, d: `M ${r2(from.x)} ${r2(from.y)} L ${r2(to.x)} ${r2(to.y)}` }
}

/**
 * The fixed "search anchor" lollipop above the cell where the walk began: a dot
 * floating SCAN_ANCHOR_RISE above the cell top, with a vertical stem down to the
 * reach line. The dot's x is the cell center and never depends on how far the
 * walk has reached, so it marks where the search started. PURE.
 */
export function scanAnchor(i: number): {
  dot: Pt & { r: number }
  stem: { x: number; y1: number; y2: number }
} {
  const x = cellCenter(i).x
  return {
    dot: { x, y: -SCAN_ANCHOR_RISE, r: SCAN_ANCHOR_RADIUS },
    stem: { x, y1: -SCAN_ANCHOR_RISE + SCAN_ANCHOR_RADIUS, y2: -SCAN_REACH_RISE },
  }
}

/* ----------------------------- capacity frame ----------------------------- */

/** `capacity` contiguous slot boxes in a row (the backing block for A6). */
export function capacitySlots(capacity: number): Box[] {
  return Array.from({ length: Math.max(0, capacity) }, (_, i) => cellBox(i))
}

/**
 * The doubling layout: the old block, the new block twice as wide, and the
 * copy map (each old slot i copies straight across to new slot i).
 */
export function doubledLayout(capacity: number): {
  from: Box[]
  to: Box[]
  copyMap: { from: number; to: number }[]
} {
  return {
    from: capacitySlots(capacity),
    to: capacitySlots(capacity * 2),
    copyMap: Array.from({ length: Math.max(0, capacity) }, (_, i) => ({ from: i, to: i })),
  }
}
