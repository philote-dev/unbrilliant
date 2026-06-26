/**
 * Pure geometry for the contiguous ArrayStrip: a row of cells that TOUCH (gap 0,
 * the load-bearing "contiguity" fact) over an address ruler rendered beneath.
 * No DOM, no React, every function deterministic, so the routing math is
 * unit-tested in node (jsdom zeroes getBoundingClientRect). The figure is a thin
 * shell that scales this intrinsic layout to fit its container.
 *
 * Two access overlays make the O(1)-vs-O(n) asymmetry visible:
 *  - `jumpMarker(k, n)`: a halo circle FIXED centered above the whole array, with
 *    a straight line reaching from it down to cell k's top (the one direct
 *    lookup). The halo never moves; only the line's far end follows the cell, so
 *    the end cells get the longest, most-angled lines.
 *  - `scanPath(k)`: a step-by-step polyline through cell centers 0..k (a walk).
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
export const JUMP_RISE = 52 // how far above the array top the fixed halo sits

/**
 * A single "jump" marker: a halo circle FIXED centered above the whole strip,
 * with a straight line reaching from the halo's center down to cell k's top. The
 * halo position depends only on the strip size (n), never on the selection, so
 * the line is the only thing that moves: short and near-vertical for the middle,
 * long and angled for the end cells. One direct lookup, no walking (the O(1)
 * picture). Coordinates are in the strip's space, where y = 0 is the top edge of
 * the cell row, so the halo sits at a negative y above the array.
 */
export function jumpMarker(
  k: number,
  n: number,
): {
  cell: Pt // top-center of cell k (where the lookup lands)
  circle: Pt & { r: number } // the fixed halo, centered above the array
  d: string // the straight connector: halo center -> cell top
} {
  const cell: Pt = { x: cellCenter(k).x, y: 0 }
  const circle = { x: stripExtent(n).width / 2, y: -JUMP_RISE, r: JUMP_RADIUS }
  const d = `M ${r2(circle.x)} ${r2(circle.y)} L ${r2(cell.x)} ${r2(cell.y)}`
  return { cell, circle, d }
}

/**
 * A step-by-step "scan": a polyline through the centers of cells 0..k, the
 * O(n) search picture (you walk every cell until the value matches).
 */
export function scanPath(toIndex: number): { points: Pt[]; d: string } {
  const points: Pt[] = []
  for (let i = 0; i <= toIndex; i++) points.push(cellCenter(i))
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${r2(p.x)} ${r2(p.y)}`)
    .join(" ")
  return { points, d }
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
