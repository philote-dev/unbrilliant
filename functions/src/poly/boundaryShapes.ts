import type { HintArgs } from "./hint"

/** Authored, finite boundary set per skill. Each entry is a boundary-condition
 * shape worth precomputing. Extend alongside each mechanic's diagnose(). */
export const BOUNDARY_SHAPES: HintArgs[] = [
  {
    stageId: "arrays",
    skill: "grow",
    discipline: "array",
    learnerOrder: ["grow the block by one slot"],
    boundary: true,
    configKey: "full-block",
    diagnosis: { kind: "grow-by-one", stepNumber: 0 },
    mode: "hint",
  },
  // Linked Lists insert boundaries. The attempt is POSITIONAL (role-based, no
  // node labels) because LL labels are randomized per learner while these hints
  // are cached and shared; it mirrors describeWritesGeneric so the precomputed
  // entry matches exactly what the Stage sends. Only discipline/skill/mode/kind/
  // stepNumber/configKey form the cache key, so learnerOrder/attempt never split
  // the cache.
  {
    stageId: "linked-lists",
    skill: "llInsert",
    discipline: "linked-list",
    learnerOrder: ["A", "B"],
    boundary: true,
    configKey: "head-insert",
    diagnosis: { kind: "repointed-before-saving", stepNumber: 1 },
    attempt: ["aimed the node before the gap at the new node"],
    mode: "hint",
  },
  {
    stageId: "linked-lists",
    skill: "llInsert",
    discipline: "linked-list",
    learnerOrder: ["A", "B"],
    boundary: true,
    configKey: "tail-insert",
    diagnosis: { kind: "repointed-before-saving", stepNumber: 1 },
    attempt: ["aimed the node before the gap at the new node"],
    mode: "hint",
  },
]
