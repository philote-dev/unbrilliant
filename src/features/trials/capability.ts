import type { Cost, DesignState, Position, SegmentSpec, StructureKind, VerdictResult } from "./types"

export const CAPABILITY: Record<StructureKind, Partial<Record<Position, Cost>>> = {
  queue: { front: "cheap", back: "cheap", middle: "impossible" },
  stack: { top: "cheap", front: "impossible", back: "impossible" },
  array: { byIndex: "cheap", back: "cheap", middle: "expensive", front: "expensive" },
  "linked-list": { front: "cheap", back: "cheap", middle: "cheap", current: "cheap" },
}

export function costAt(structure: StructureKind, position: Position): Cost {
  return CAPABILITY[structure][position] ?? "impossible"
}

export function costWord(cost: Cost): string {
  return cost === "cheap" ? "small" : cost === "expensive" ? "large" : "can't do that here"
}

const RANK: Record<Cost | "misplaced", number> = {
  cheap: 0,
  expensive: 1,
  impossible: 2,
  misplaced: 2,
}

export function classify(design: DesignState, segment: SegmentSpec): VerdictResult {
  let worst: Cost | "misplaced" = "cheap"
  for (const { op, position } of segment.required) {
    const placed = design.mapping[op]
    const cost: Cost | "misplaced" =
      placed == null || placed !== position ? "misplaced" : costAt(design.structure, position)
    if (RANK[cost] > RANK[worst]) worst = cost
  }
  if (worst === "impossible" || worst === "misplaced") {
    return { status: "broken", explainId: "broken", nudgeId: segment.brokenNudgeId }
  }
  if (worst === "expensive") {
    return { status: "strained", explainId: "strained", nudgeId: segment.strainedNudgeId }
  }
  return { status: "viable", explainId: "viable" }
}
