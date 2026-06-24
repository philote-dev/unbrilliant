import { keySum } from "@/features/lesson/hashTablesEngine"

/**
 * Fictional cloakroom garments for the real-world skin of Hash Tables. Like
 * `songFor` in the playlist skin, the mapping is deterministic: a given key (a
 * coat owner's name) always yields the same garment, so the same name hashing to
 * the same hook also *looks* the same every render. Art is a CSS gradient, so we
 * ship no images.
 */
export type GarmentKind =
  | "parka"
  | "trench"
  | "puffer"
  | "raincoat"
  | "peacoat"
  | "bomber"
  | "cardigan"
  | "windbreaker"

export interface Garment {
  /** The coat's owner (the key, title-cased into a name). */
  owner: string
  /** A short human label, e.g. "Ivy's parka". */
  label: string
  /** Two colours for the garment swatch gradient. */
  art: [string, string]
  kind: GarmentKind
}

const KINDS: GarmentKind[] = [
  "parka",
  "trench",
  "puffer",
  "raincoat",
  "peacoat",
  "bomber",
  "cardigan",
  "windbreaker",
]

const PALETTE: [string, string][] = [
  ["#7c3aed", "#2563eb"],
  ["#0ea5e9", "#14b8a6"],
  ["#f59e0b", "#ef4444"],
  ["#6366f1", "#0f172a"],
  ["#10b981", "#0891b2"],
  ["#eab308", "#f97316"],
  ["#a855f7", "#ec4899"],
  ["#475569", "#1e293b"],
]

const titleCase = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * The garment for a coat owner. Keyed by the name itself (not its position on a
 * hook), so a person's coat is always their own coat: deterministic, and stable
 * whether it hangs alone or shares a hook after a collision.
 */
export function garmentFor(key: string): Garment {
  const h = keySum(key)
  const kind = KINDS[h % KINDS.length]
  const art = PALETTE[h % PALETTE.length]
  const owner = titleCase(key)
  return { owner, label: `${owner}'s ${kind}`, art, kind }
}
