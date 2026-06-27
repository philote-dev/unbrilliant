import { Easing } from "remotion";

export type PathPoint = { frame: number; x: number; y: number; curve?: number };

// Natural acceleration: slow start, ramp up, slow into the target.
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

/**
 * Sample a hand-like pointer position at `frame`: eased per segment (slow-fast-
 * slow) and bowed along a quadratic curve (people don't drag in straight lines).
 * `curve` is the perpendicular bulge in px for the segment ending at that point.
 */
export function pointAt(path: PathPoint[], frame: number): { x: number; y: number } {
  const first = path[0];
  const last = path[path.length - 1];
  if (frame <= first.frame) return { x: first.x, y: first.y };
  if (frame >= last.frame) return { x: last.x, y: last.y };

  let i = 0;
  while (i < path.length - 1 && frame > path[i + 1].frame) i++;
  const a = path[i];
  const b = path[i + 1];
  const t = easeInOut((frame - a.frame) / (b.frame - a.frame));

  const curve = b.curve ?? 0;
  if (!curve) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * curve;
  const cy = my + (dx / len) * curve;
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * cx + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * cy + t * t * b.y,
  };
}
