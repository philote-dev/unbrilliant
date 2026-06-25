/**
 * Fictional sample cars for the drive-thru / toll-lane beat (the real-world skin
 * of the queue predict). Names / orders are invented; the car body is a CSS
 * gradient so we ship no images. Cars map to lane positions by their arrival
 * index, so the mapping is deterministic for a given line. This is the queue
 * mirror of playlistSongs.ts.
 *
 * The engine's queue-realworld labels (see stacksQueuesEngine.ts) mirror the
 * first entries here so the fallback abstract container still reads sensibly,
 * but the skin always uses carFor() for the real car identity. The engine copy
 * never names a specific car, so the two files stay decoupled.
 */
export interface DriveThruCar {
  /** A short colour name shown as the car's label. */
  name: string
  /** The order this driver placed (flavour text under the car). */
  order: string
  /** Two colours for the car-body gradient. */
  accent: [string, string]
}

const CARS: DriveThruCar[] = [
  { name: "Red", order: "2 burgers", accent: ["#ef4444", "#b91c1c"] },
  { name: "Blue", order: "Iced tea", accent: ["#3b82f6", "#1d4ed8"] },
  { name: "Green", order: "Salad box", accent: ["#10b981", "#047857"] },
  { name: "Amber", order: "Fries", accent: ["#f59e0b", "#b45309"] },
  { name: "Violet", order: "Milkshake", accent: ["#8b7fd6", "#6d28d9"] },
  { name: "Teal", order: "Coffee", accent: ["#14b8a6", "#0f766e"] },
]

/**
 * The car for a lane position. Cars map to the catalogue by their position in
 * the arrival order, so a given line always yields the same cars.
 */
export function carFor(id: string, arrival: string[]): DriveThruCar {
  const i = arrival.indexOf(id)
  const idx = i < 0 ? 0 : i
  return CARS[((idx % CARS.length) + CARS.length) % CARS.length]
}
