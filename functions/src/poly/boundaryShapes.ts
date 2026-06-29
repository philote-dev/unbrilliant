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
]
