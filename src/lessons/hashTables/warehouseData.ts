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

// Kraft cardboard, all shades of the brand tan (#cea968) so every box looks the
// same: you can't sort them by sight, which is exactly why the index matters.
const PALETTE: [string, string][] = [
  ["#cea968", "#b8935a"],
  ["#d8b985", "#bf9a61"],
  ["#c8a05f", "#ad8348"],
  ["#d2ad6f", "#b58f55"],
  ["#cea968", "#ba9457"],
  ["#dcb87e", "#c19a5e"],
  ["#c5a05c", "#a87d42"],
  ["#d6b277", "#b88f54"],
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
