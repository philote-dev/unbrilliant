import type { PropScore } from "@/lib/ai/polyClient"

type Verdict = PropScore["verdict"]

const RANK: Record<Verdict, number> = { missing: 0, partial: 1, covered: 2 }

/** Keep the best verdict seen for each proposition across exchanges, so prior
 * coverage is never lost when a later turn answers only one gap. This is the
 * core fix for "I said the right thing but it stopped counting it". */
export function mergeScores(prev: PropScore[], next: PropScore[]): PropScore[] {
  const best = new Map<string, Verdict>()
  const order: string[] = []
  for (const sc of [...prev, ...next]) {
    const current = best.get(sc.id)
    if (current === undefined) order.push(sc.id)
    if (current === undefined || RANK[sc.verdict] > RANK[current]) best.set(sc.id, sc.verdict)
  }
  return order.map((id) => ({ id, verdict: best.get(id)! }))
}

/** Looser pass: succeed if nothing is missing (partial counts), or if at least
 * two-thirds of the propositions are fully covered. Empty scores never pass (a
 * scoring failure must not read as success). Non-gating either way. */
export function isTeachbackPass(scores: PropScore[]): boolean {
  if (scores.length === 0) return false
  const covered = scores.filter((sc) => sc.verdict === "covered").length
  const missing = scores.filter((sc) => sc.verdict === "missing").length
  if (missing === 0) return true
  return covered >= Math.ceil((2 / 3) * scores.length)
}

/** The next gap to probe: the first missing, else the first partial, else none. */
export function pickWeakest(scores: PropScore[]): string | null {
  return (
    scores.find((sc) => sc.verdict === "missing")?.id ??
    scores.find((sc) => sc.verdict === "partial")?.id ??
    null
  )
}
