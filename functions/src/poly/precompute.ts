import type { Completer } from "../openai"
import { generateHint, type HintArgs } from "./hint"
import type { HintCache } from "./hintCache"

export interface PrecomputeResult {
  attempted: number
  cached: number
}

/** Generate + verify + store each boundary shape. Reuses generateHint with the
 * cache, so a verified hint is written and a rejected one is simply skipped. */
export async function precomputeBoundaryHints(deps: {
  completer: Completer
  model: string
  cache: HintCache
  shapes: HintArgs[]
}): Promise<PrecomputeResult> {
  let cached = 0
  for (const shape of deps.shapes) {
    const r = await generateHint(
      deps.completer,
      deps.model,
      { ...shape, boundary: true },
      deps.cache,
    )
    if (r.hint) cached += 1
  }
  return { attempted: deps.shapes.length, cached }
}
