import { keySum } from "@/features/lesson/hashTablesEngine"

/**
 * Fictional warehouse stock for the real-world skin of Hash Tables (Amazon-style
 * chaotic storage). Like `songFor` in the playlist skin, the mapping is
 * deterministic: a given key (a product's short code) always yields the same
 * item, so the same code hashing to the same bin also *looks* the same every
 * render. Art is a CSS gradient (kraft cardboard), so we ship no images.
 */
export type ItemKind =
  | "box"
  | "envelope"
  | "tube"
  | "crate"
  | "pouch"
  | "drum"
  | "carton"
  | "flat"

export interface WarehouseItem {
  /** A scannable stock code derived from the key, e.g. "IVY-58". */
  sku: string
  /** A human product name for the label. */
  name: string
  /** The human "logical" category (only used by the demo's sorted view). */
  category: string
  /** Two colours for the cardboard swatch gradient. */
  art: [string, string]
  kind: ItemKind
}

interface Product {
  name: string
  category: string
}

const PRODUCTS: Product[] = [
  { name: "Headphones", category: "Electronics" },
  { name: "Paperback novel", category: "Books" },
  { name: "Coffee beans", category: "Grocery" },
  { name: "Running shoes", category: "Apparel" },
  { name: "Desk lamp", category: "Home" },
  { name: "Phone case", category: "Electronics" },
  { name: "Dog treats", category: "Pet" },
  { name: "Water bottle", category: "Sports" },
]

const KINDS: ItemKind[] = [
  "box",
  "envelope",
  "tube",
  "crate",
  "pouch",
  "drum",
  "carton",
  "flat",
]

// Kraft cardboard + safety-orange / steel-blue accents.
const PALETTE: [string, string][] = [
  ["#d9a86c", "#b07d4f"],
  ["#c9954f", "#9c6b39"],
  ["#e0b07a", "#bb8a55"],
  ["#cf9b63", "#a6764a"],
  ["#d2a266", "#a97d49"],
  ["#dfb27d", "#b58a57"],
  ["#c89657", "#9e7040"],
  ["#dcaa70", "#b1814f"],
]

const upper = (s: string): string => s.toUpperCase()

/**
 * The stock item for a product code. Keyed by the code itself (not its position
 * in a bin), so an item is always the same item: deterministic, and stable
 * whether it sits alone or shares a bin after a collision.
 */
export function itemFor(key: string): WarehouseItem {
  const h = keySum(key)
  const product = PRODUCTS[h % PRODUCTS.length]
  return {
    sku: `${upper(key)}-${h}`,
    name: product.name,
    category: product.category,
    art: PALETTE[h % PALETTE.length],
    kind: KINDS[h % KINDS.length],
  }
}
