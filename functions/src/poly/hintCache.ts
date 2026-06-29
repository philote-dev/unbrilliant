import type { HintArgs } from "./hint"

export interface HintCache {
  get(key: string): Promise<string | null>
  set(key: string, hint: string): Promise<void>
}

/** Deterministic, giveaway-free cache key. Phrasing-only fields are excluded so
 * wording variety never fragments the cache. Sanitized to a safe Firestore id. */
export function hintCacheKey(args: HintArgs): string {
  const mode = args.mode ?? "hint"
  const kind = args.diagnosis?.kind ?? "none"
  const step = args.diagnosis?.stepNumber ?? 0
  const config = args.configKey ?? ""
  const raw = `${args.discipline}:${args.skill}:${mode}:${kind}:${step}:${config}`
  // The components above are expected to be key-safe enum/authored tokens
  // (discipline, skill, mode, diagnosis kind, configKey). This sanitizing map
  // ([^A-Za-z0-9_-] -> _) is non-injective: distinct unsafe inputs can collapse
  // to the same id, so callers must not rely on free-form text in the key.
  return raw.replace(/[^A-Za-z0-9_-]/g, "_")
}

export class InMemoryHintCache implements HintCache {
  private store = new Map<string, string>()
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async set(key: string, hint: string): Promise<void> {
    this.store.set(key, hint)
  }
}
