import { pointerId, sourceNode, NIL, type RewirePair } from "@/features/lesson/linkedListsEngine"

export type LLErrorKind =
  | "repointed-before-saving" // aimed prev -> new before new -> at (orphans the tail)
  | "wrong-target" // a write aimed at a node outside the correct map
  | "incomplete" // safe so far, not yet complete
  | "off-path"

export interface LLInsertQuestion {
  head: string
  prev: string
  at: string
  newNode: string
  nodes: string[]
  correctNext: Record<string, string>
}

export interface LLDiagnosis {
  kind: LLErrorKind
  stepNumber: number // 1-based index of the offending write
  boundary: boolean
  configKey: string
}

function configFor(q: LLInsertQuestion): { boundary: boolean; configKey: string } {
  if (q.prev === q.head) return { boundary: true, configKey: "head-insert" }
  if (q.at === NIL) return { boundary: true, configKey: "tail-insert" }
  if (q.nodes.length <= 2) return { boundary: true, configKey: "single-node" }
  return { boundary: false, configKey: "interior" }
}

/** Structural, giveaway-free read of an insert attempt. Names no correct move,
 * only WHICH of the learner's writes first left the safe line. */
export function diagnoseLinkedListInsert(
  q: LLInsertQuestion,
  writes: RewirePair[],
): LLDiagnosis | null {
  if (writes.length === 0) return null
  const cfg = configFor(q)
  const savedAt = writes.findIndex((w) => w.from === pointerId(q.newNode) && w.to === q.at)
  const repointAt = writes.findIndex((w) => w.from === pointerId(q.prev) && w.to === q.newNode)

  if (repointAt >= 0 && (savedAt < 0 || savedAt > repointAt)) {
    return { kind: "repointed-before-saving", stepNumber: repointAt + 1, ...cfg }
  }
  const correctTargets = new Set(Object.values(q.correctNext))
  const badTarget = writes.findIndex((w) => !correctTargets.has(w.to))
  if (badTarget >= 0) {
    return { kind: "wrong-target", stepNumber: badTarget + 1, ...cfg }
  }
  const done =
    savedAt >= 0 && writes.some((w) => w.from === pointerId(q.prev) && w.to === q.newNode)
  if (!done) return { kind: "incomplete", stepNumber: writes.length, ...cfg }
  return { kind: "off-path", stepNumber: writes.length, ...cfg }
}

/* --------------------------- label-free attempt --------------------------- */

/** The subset of the question that fixes each pointer's STRUCTURAL role. Kept
 * nullable so the Stage can pass its live question straight through. */
type InsertRoles = { prev: string | null; at: string | null; newNode: string | null }

function describeSource(from: string, q: InsertRoles): string {
  const node = sourceNode(from)
  if (node === q.newNode) return "the new node"
  if (node === q.prev) return "the node before the gap"
  return "an earlier node"
}

function describeTarget(to: string, q: InsertRoles): string {
  if (to === q.newNode) return "the new node"
  if (to === q.at) return "the node that should follow it"
  if (to === NIL) return "the end"
  return "another node"
}

/**
 * Turn the learner's writes into a POSITIONAL, label-free trace. Linked-list
 * node labels are randomized per learner, but boundary hints are cached and
 * shared, so a cached prompt must never embed a concrete label. Each write is
 * described purely by the role its endpoints play in the splice (the new node,
 * the node before the gap, the node that should follow it, the end), which is
 * identical across learners and therefore safe to cache.
 */
export function describeWritesGeneric(q: InsertRoles, writes: RewirePair[]): string[] {
  return writes.map((w) => `aimed ${describeSource(w.from, q)} at ${describeTarget(w.to, q)}`)
}
