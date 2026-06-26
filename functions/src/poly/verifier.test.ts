import { describe, it, expect } from "vitest"
import { findGiveaway } from "./verifier"
import { rubricFor, propositionsByIds } from "./rubrics"
import { targetsForSkill } from "./skillMap"
import type { Proposition } from "./types"

const props: Proposition[] = [
  { id: "P1", text: "LIFO", answerTokens: ["lifo", "last in first out"] },
  { id: "P2", text: "top only", answerTokens: ["top"] },
  { id: "P3", text: "consequence", answerTokens: [""] },
]

describe("findGiveaway", () => {
  it("passes text that contains no withheld tokens", () => {
    expect(findGiveaway("Look again at the card you moved first.", props)).toEqual({
      ok: true,
      leaked: [],
    })
  })

  it("flags a withheld proposition when a token appears (case-insensitive)", () => {
    const res = findGiveaway("Remember it is LIFO here.", props)
    expect(res.ok).toBe(false)
    expect(res.leaked).toContain("P1")
  })

  it("matches multi-word tokens as substrings", () => {
    expect(findGiveaway("that is last in first out", props).leaked).toContain("P1")
  })

  it("never flags on empty tokens (P3 with a blank token is not a match)", () => {
    expect(findGiveaway("anything at all", [props[2]])).toEqual({ ok: true, leaked: [] })
  })

  it("reports every leaked proposition", () => {
    const res = findGiveaway("the top is LIFO", props)
    expect(res.ok).toBe(false)
    expect(res.leaked.sort()).toEqual(["P1", "P2"])
  })

  it("composes with the skill map and rubric (the chunk 3 path)", () => {
    const target = targetsForSkill("stackConstruct")!
    const rubric = rubricFor(target.conceptId)!
    const withheld = propositionsByIds(rubric, target.propositionIds)
    // A hint that blurts the LIFO answer must be rejected.
    expect(findGiveaway("just remember LIFO", withheld).ok).toBe(false)
    // A hint that only nudges at the action is fine.
    expect(findGiveaway("Check the order you placed the first two cards.", withheld).ok).toBe(true)
  })

  it("catches the broadened FIFO phrasing via the real queues rubric", () => {
    const withheld = propositionsByIds(rubricFor("queues")!, ["P1"])
    expect(findGiveaway("Is it first one in here?", withheld).ok).toBe(false)
  })
})
