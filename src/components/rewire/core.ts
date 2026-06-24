/**
 * Pure geometry/keyboard/intent helpers for the rewire surface. No DOM, no
 * React — every function is deterministic so the same gesture always yields the
 * same intent. The React layer (RewireSurface) is a thin shell over these; all
 * the decidable logic lives here where it can be unit-tested in node.
 */

export interface Point {
  x: number
  y: number
}

/** A target's viewport-space box (from `getBoundingClientRect`), tagged by id. */
export interface TargetRect {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

/** The semantic gesture result the surface emits — opaque `from`/`to` ids. */
export interface RewireIntent {
  from: string
  to: string
}

/** Is the point inside the rect, expanded by a forgiving `tolerance` (px)? */
export function isWithin(p: Point, r: TargetRect, tolerance = 0): boolean {
  return (
    p.x >= r.left - tolerance &&
    p.x <= r.right + tolerance &&
    p.y >= r.top - tolerance &&
    p.y <= r.bottom + tolerance
  )
}

function centerDistanceSq(p: Point, r: TargetRect): number {
  const cx = (r.left + r.right) / 2
  const cy = (r.top + r.bottom) / 2
  const dx = p.x - cx
  const dy = p.y - cy
  return dx * dx + dy * dy
}

/**
 * The id of the target the point lands on, or `null` if it hits nothing within
 * tolerance. When several rects overlap the point, the one whose center is
 * nearest wins; ties keep the earlier target (stable, deterministic).
 */
export function resolveDropTarget(
  p: Point,
  targets: TargetRect[],
  tolerance = 0,
): string | null {
  let best: TargetRect | null = null
  let bestDist = Infinity
  for (const t of targets) {
    if (!isWithin(p, t, tolerance)) continue
    const d = centerDistanceSq(p, t)
    if (d < bestDist) {
      best = t
      bestDist = d
    }
  }
  return best ? best.id : null
}

/**
 * Turn a resolved drop into an intent: a hit target becomes a `from → to`
 * intent; no target (`null`) means a snap-back, so nothing is emitted.
 */
export function resolveIntent(from: string, toId: string | null): RewireIntent | null {
  return toId == null ? null : { from, to: toId }
}

/**
 * Step the keyboard selection through the ordered target ids, wrapping at both
 * ends. With nothing selected, forward starts at the first target and backward
 * at the last; an unknown current id restarts. Empty list → `null`.
 */
export function cycleTarget(
  currentId: string | null,
  orderedIds: string[],
  dir: 1 | -1,
): string | null {
  const n = orderedIds.length
  if (n === 0) return null
  const index = currentId == null ? -1 : orderedIds.indexOf(currentId)
  if (index === -1) return dir === 1 ? orderedIds[0] : orderedIds[n - 1]
  return orderedIds[(index + dir + n) % n]
}
