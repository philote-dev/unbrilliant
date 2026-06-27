import { describe, it, expect } from "vitest"
import { skillTargets, targetsForSkill } from "./skillMap"
import { rubricFor } from "./rubrics"

describe("skillMap", () => {
  it("maps the construct skills to their concept and propositions", () => {
    expect(targetsForSkill("stackConstruct")).toEqual({
      conceptId: "stacks",
      propositionIds: ["P1", "P3"],
    })
    expect(targetsForSkill("queueConstruct")).toEqual({
      conceptId: "queues",
      propositionIds: ["P1", "P3"],
    })
    expect(targetsForSkill("unknownSkill")).toBeUndefined()
  })

  it("maps the arrays grow skill to the arrays concept and its withheld propositions", () => {
    expect(targetsForSkill("grow")).toEqual({
      conceptId: "arrays",
      propositionIds: ["P2", "P3"],
    })
  })

  it("every mapped proposition id exists in the referenced rubric", () => {
    for (const target of Object.values(skillTargets)) {
      const rubric = rubricFor(target.conceptId)
      expect(rubric, `missing rubric ${target.conceptId}`).toBeDefined()
      const ids = rubric!.propositions.map((p) => p.id)
      for (const pid of target.propositionIds) {
        expect(ids, `${target.conceptId} missing ${pid}`).toContain(pid)
      }
    }
  })
})
