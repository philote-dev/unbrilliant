import type { Firestore } from "firebase-admin/firestore"
import type { HintCache } from "./hintCache"

export interface FirestoreHintCacheOptions {
  collection?: string
  /** When provided, set() persists ONLY keys in this set; any other key is a
   * silent no-op. The public callable passes an allowlist derived from the
   * authored BOUNDARY_SHAPES so a hostile caller cannot poison or grow the
   * cache with attacker-chosen keys. Omit it for trusted writers (the offline
   * precompute runner, unit tests). */
  allowlist?: Set<string>
}

/** Server-only hint cache. Read/written via the admin SDK, which bypasses
 * security rules; no client rule is added, so the browser cannot read it. */
export function firestoreHintCache(
  db: Firestore,
  options: FirestoreHintCacheOptions = {},
): HintCache {
  const collection = options.collection ?? "hintCache"
  const { allowlist } = options
  return {
    async get(key) {
      const snap = await db.collection(collection).doc(key).get()
      return snap.exists ? ((snap.get("hint") as string) ?? null) : null
    },
    async set(key, hint) {
      if (allowlist && !allowlist.has(key)) return // cache-poisoning guard
      await db.collection(collection).doc(key).set({ hint, updatedAt: Date.now() })
    },
  }
}
