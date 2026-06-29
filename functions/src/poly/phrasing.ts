// Authored, giveaway-free lead-ins. Applied AFTER verification, so they must
// never contain answer items (they are fixed strings, so they cannot).
const LEADINS = ["", "One more look: ", "Try this angle: "] as const

/** Vary wording by attempt without a new model call. The base hint is cached;
 * this transform is applied at serve time so repeats do not feel identical. */
export function applyPhrasing(hint: string, opts: { attemptIndex?: number }): string {
  const i = Math.floor(Math.max(0, opts.attemptIndex ?? 0))
  const lead = LEADINS[Math.min(i, LEADINS.length - 1)]
  return lead ? lead + hint : hint
}
