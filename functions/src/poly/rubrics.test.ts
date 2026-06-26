import { describe, it, expect } from "vitest"
import { RUBRICS, rubricFor, propositionsByIds } from "./rubrics"

describe("rubrics", () => {
  it("exposes a stacks and a queues rubric by concept id", () => {
    expect(rubricFor("stacks")?.conceptId).toBe("stacks")
    expect(rubricFor("queues")?.conceptId).toBe("queues")
    expect(rubricFor("nope")).toBeUndefined()
  })

  it("every proposition in every rubric has at least one non-empty answer token", () => {
    for (const rubric of Object.values(RUBRICS)) {
      expect(rubric.propositions.length).toBeGreaterThanOrEqual(2)
      for (const p of rubric.propositions) {
        const usable = p.answerTokens.filter((t) => t.trim() !== "")
        expect(usable.length, `${rubric.conceptId}/${p.id} needs tokens`).toBeGreaterThan(0)
      }
    }
  })

  it("propositionsByIds returns only the requested propositions, in rubric order", () => {
    const stacks = rubricFor("stacks")!
    const picked = propositionsByIds(stacks, ["P3", "P1"])
    expect(picked.map((p) => p.id)).toEqual(["P1", "P3"])
  })
})
