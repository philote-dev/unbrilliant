/**
 * Pure geometry for the literal-arrow NodeGraph. No DOM, no React — given node
 * boxes it computes where each box sits and the SVG path for a `next` arrow
 * between two boxes.
 *
 * Nodes are circles, so every arrow is anchored on the node's **edge** along the
 * line it travels (it "wraps" the circular rim instead of poking out of a fixed
 * cardinal point), and the shaft stops at the arrowhead's base so the head reads
 * as one **continuous** stroke. Two routings:
 *  - `directArrow` — a straight edge-to-edge arrow between any two circles, used
 *    when nodes are freely placed (the drag demo).
 *  - `arrowGeom` — the structured routing for the tidy row: straight between
 *    row-adjacent nodes, an arc **above** the row for non-adjacent same-row links
 *    (clearing the nodes between), and a diagonal arc to/from a loose node.
 *
 * Everything is deterministic and unit-testable in node (jsdom zeroes
 * getBoundingClientRect, so the routing math must live here, not in the figure).
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}
export interface Pt {
  x: number
  y: number
}

/** Circular nodes: width === height, drawn as `rounded-full`. */
export const NODE_W = 52
export const NODE_H = 52
/** Node radius (used for circular edge anchoring). */
export const NODE_R = NODE_W / 2
export const GAP_X = 30
export const GAP_Y = 30
export const ROW_Y = 16
export const MARGIN_X = 16
/** Vertical drop from the row to a loose (not-yet-spliced) node. */
export const LOOSE_GAP = 56

/** Arrowhead length, half-width, and how far the shaft stops behind the tip. */
export const HEAD_LEN = 9
export const HEAD_HALF = 5
const SHAFT_BACK = 7 // shaft ends here (slightly inside the head → no seam)

/** Left→right row of equal boxes; index 0 is the head. */
export function rowBoxes(ids: string[]): Map<string, Box> {
  const boxes = new Map<string, Box>()
  ids.forEach((id, i) => {
    boxes.set(id, { x: MARGIN_X + i * (NODE_W + GAP_X), y: ROW_Y, w: NODE_W, h: NODE_H })
  })
  return boxes
}

/** Top→bottom column of equal boxes; index 0 is the head (mobile-friendly). */
export function columnBoxes(ids: string[]): Map<string, Box> {
  const boxes = new Map<string, Box>()
  ids.forEach((id, i) => {
    boxes.set(id, { x: MARGIN_X, y: ROW_Y + i * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H })
  })
  return boxes
}

/**
 * Boustrophedon ("snake") wrap into rows of `perRow`: even rows run left→right,
 * odd rows right→left, so each row's last node sits directly above the next row's
 * first node — every consecutive link is a plain neighbour (horizontal or a clean
 * vertical turn), no backtracking arrows. Keeps nodes full-size on a narrow phone.
 */
export function wrapBoxes(ids: string[], perRow: number): Map<string, Box> {
  const cols = Math.max(1, perRow)
  const boxes = new Map<string, Box>()
  ids.forEach((id, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const col = r % 2 === 0 ? c : cols - 1 - c
    boxes.set(id, {
      x: MARGIN_X + col * (NODE_W + GAP_X),
      y: ROW_Y + r * (NODE_H + GAP_Y),
      w: NODE_W,
      h: NODE_H,
    })
  })
  return boxes
}

/** The drawing extent (width/height) of a set of boxes, plus the standard margins. */
export function boxesExtent(boxes: Iterable<Box>): { width: number; height: number } {
  let width = 0
  let height = 0
  for (const b of boxes) {
    width = Math.max(width, b.x + b.w)
    height = Math.max(height, b.y + b.h)
  }
  return { width: width + MARGIN_X, height: height + ROW_Y }
}

/** A loose node centered on `centerX`, dropped below the row. */
export function looseBox(centerX: number): Box {
  return { x: centerX - NODE_W / 2, y: ROW_Y + NODE_H + LOOSE_GAP, w: NODE_W, h: NODE_H }
}

/**
 * The playlist queue draws each `next` pointer as an elbow that drops down a
 * right-side rail. With one shared rail, two pointers that land on the same track
 * (the transient save-first state, where both prev->at and X->at exist at once)
 * stack their arrowheads at a single point. Fan each elbow into its own lane by
 * the SOURCE row index: a distinct vertical rail x plus a small staggered entry
 * height, so every arrowhead lands somewhere unique. Pure and deterministic.
 */
export function elbowLane(
  baseRailX: number,
  sourceRowIndex: number,
  step = 5,
): { railX: number; entryDy: number } {
  const i = Math.max(0, Math.trunc(sourceRowIndex))
  return { railX: baseRailX - i * step, entryDy: (i % 3) * 6 }
}

export function center(b: Box): Pt {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

/** A box's circular radius (half its smaller side). */
export function radius(b: Box): number {
  return Math.min(b.w, b.h) / 2
}

/** Total drawing surface needed for a row of `n` boxes (+ room for a loose node). */
export function surfaceSize(n: number): { width: number; height: number } {
  const width = MARGIN_X * 2 + n * NODE_W + Math.max(0, n - 1) * GAP_X
  const height = ROW_Y + NODE_H + LOOSE_GAP + NODE_H + ROW_Y
  return { width, height }
}

/** Same row (within a px) and centers one slot apart → a straight link is safe. */
export function isAdjacentRow(a: Box, b: Box): boolean {
  if (Math.abs(a.y - b.y) > 0.5) return false
  const dx = Math.abs(center(a).x - center(b).x)
  return dx > 0 && dx <= NODE_W + GAP_X + 1
}

export interface ArrowGeom {
  /** SVG path `d` — the shaft, stopping at the arrowhead's base (continuous head). */
  d: string
  /** The arrowhead tip, on the target's circular edge. */
  tip: Pt
  /** Tip heading in degrees (for rotating the arrowhead). */
  angleDeg: number
  /** A point on the path for the draggable grip / the loose nub. */
  mid: Pt
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)
const deg = (rad: number) => (rad * 180) / Math.PI

/** Unit vector from a→b; falls back to a rightward vector if the points coincide. */
function unit(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: 1, y: 0 }
  return { x: dx / len, y: dy / len }
}

const along = (p: Pt, dir: Pt, dist: number): Pt => ({ x: p.x + dir.x * dist, y: p.y + dir.y * dist })

/** Assemble an arrow from already-resolved edge points + a heading + optional control. */
function build(start: Pt, tip: Pt, headDir: Pt, mid: Pt, control?: Pt): ArrowGeom {
  const base = along(tip, headDir, -SHAFT_BACK)
  const d = control
    ? `M ${r(start.x)} ${r(start.y)} Q ${r(control.x)} ${r(control.y)} ${r(base.x)} ${r(base.y)}`
    : `M ${r(start.x)} ${r(start.y)} L ${r(base.x)} ${r(base.y)}`
  return { d, tip, angleDeg: deg(Math.atan2(headDir.y, headDir.x)), mid }
}

/**
 * A straight `next` arrow between two circles, anchored on each rim along the
 * center→center line. Used wherever nodes are freely placed (the drag demo): the
 * arrow always emerges from `from`'s edge and lands flush on `to`'s edge.
 */
export function directArrow(from: Box, to: Box): ArrowGeom {
  const cf = center(from)
  const ct = center(to)
  const dir = unit(cf, ct)
  const start = along(cf, dir, radius(from))
  const tip = along(ct, dir, -radius(to))
  return build(start, tip, dir, { x: (start.x + tip.x) / 2, y: (start.y + tip.y) / 2 })
}

/**
 * The structured `next` arrow from `from` to `to`, routed to avoid overlapping any
 * node: straight when row-adjacent, an upward arc for non-adjacent same-row links,
 * and a clean diagonal arc when one end is the loose node below the row. Both ends
 * sit on the circular rim in the direction the curve enters/leaves.
 */
export function arrowGeom(from: Box, to: Box): ArrowGeom {
  if (isAdjacentRow(from, to)) return directArrow(from, to)

  const cf = center(from)
  const ct = center(to)
  const rf = radius(from)
  const rt = radius(to)

  let control: Pt
  if (Math.abs(ct.y - cf.y) > 1) {
    // one end is the loose node (above/below): bow gently to the side.
    control = { x: (cf.x + ct.x) / 2 + 26, y: (cf.y + ct.y) / 2 }
  } else {
    // same row but not adjacent: bow above the row to clear the nodes between.
    const bow = clamp(Math.abs(ct.x - cf.x) * 0.4, 46, 130)
    control = { x: (cf.x + ct.x) / 2, y: Math.min(cf.y, ct.y) - bow }
  }

  const startDir = unit(cf, control)
  const start = along(cf, startDir, rf)
  const endDir = unit(control, ct)
  const tip = along(ct, endDir, -rt)
  const mid: Pt = {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * tip.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * tip.y,
  }
  return build(start, tip, endDir, mid, control)
}

/** Round to a tidy 2dp for stable, snapshot-friendly path strings. */
function r(n: number): number {
  return Math.round(n * 100) / 100
}
