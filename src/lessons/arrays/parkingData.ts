/**
 * Deterministic car skins for the Arrays "parking lot" visual. A car's colour is
 * a pure function of its label's position in the array (seeded like songFor in
 * the playlist skin), so a given lot always paints the same, and a car keeps its
 * colour as it rolls between bays during a shift. The inserted "X" is always the
 * bright "arrival" car so the eye tracks the new item.
 *
 * Pure and view-only: nothing here grades or recomputes a verdict.
 */

/** The label the engine uses for the item being inserted (the arrival car). */
export const ARRIVAL_LABEL = "X"

export interface Car {
  label: string
  /** Two stops for the car-body gradient. */
  body: [string, string]
  /** The bright arrival car (the inserted X) reads differently from the rest. */
  arrival: boolean
}

/** A vivid, high-contrast fleet. Indexed by the car's position in the lot. */
const PALETTE: [string, string][] = [
  ["#6366f1", "#4338ca"], // indigo
  ["#0ea5e9", "#0369a1"], // sky
  ["#14b8a6", "#0f766e"], // teal
  ["#f97316", "#c2410c"], // orange
  ["#ec4899", "#be185d"], // pink
  ["#8b5cf6", "#6d28d9"], // violet
  ["#10b981", "#047857"], // emerald
  ["#ef4444", "#b91c1c"], // red
]

/** The arrival car: a bright, unmistakable gold so the new item pops. */
const ARRIVAL_BODY: [string, string] = ["#fde047", "#f59e0b"]

function hashLabel(label: string): number {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (Math.imul(h, 31) + label.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * The car for a labelled item. The arrival ("X") is always the gold car; every
 * other car is coloured by its index in the array (falling back to a stable hash
 * if it isn't found), so colours are deterministic and stay put as cars move.
 */
export function carFor(label: string, array: string[]): Car {
  if (label === ARRIVAL_LABEL) {
    return { label, body: ARRIVAL_BODY, arrival: true }
  }
  const at = array.indexOf(label)
  const idx = at >= 0 ? at : hashLabel(label)
  const body = PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length]
  return { label, body, arrival: false }
}
