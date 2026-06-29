import { describe, it, expect } from "vitest"
import { mergeScores, isTeachbackPass, pickWeakest } from "./teachbackScore"
import type { PropScore } from "@/lib/ai/polyClient"

const s = (id: string, verdict: PropScore["verdict"]): PropScore => ({ id, verdict })

describe("mergeScores", () => {
  it("keeps the best verdict per proposition across turns", () => {
    const turn1 = [s("P1", "covered"), s("P2", "covered"), s("P3", "missing")]
    const turn2 = [s("P1", "missing"), s("P2", "partial"), s("P3", "covered")]
    expect(mergeScores(turn1, turn2)).toEqual([
      s("P1", "covered"),
      s("P2", "covered"),
      s("P3", "covered"),
    ])
  })

  it("returns next unchanged when prior is empty", () => {
    const turn = [s("P1", "partial")]
    expect(mergeScores([], turn)).toEqual(turn)
  })

  it("returns prior unchanged when next is empty (a scoring error)", () => {
    const prior = [s("P1", "covered")]
    expect(mergeScores(prior, [])).toEqual(prior)
  })
})

describe("isTeachbackPass", () => {
  it("passes when nothing is missing (partial counts)", () => {
    expect(isTeachbackPass([s("P1", "covered"), s("P2", "partial"), s("P3", "partial")])).toBe(
      true,
    )
  })

  it("passes on two-thirds covered even with one missing", () => {
    expect(isTeachbackPass([s("P1", "covered"), s("P2", "covered"), s("P3", "missing")])).toBe(
      true,
    )
  })

  it("fails when the majority is missing", () => {
    expect(isTeachbackPass([s("P1", "covered"), s("P2", "missing"), s("P3", "missing")])).toBe(
      false,
    )
  })

  it("never passes empty scores", () => {
    expect(isTeachbackPass([])).toBe(false)
  })
})

describe("pickWeakest", () => {
  it("prefers the first missing, then the first partial, then null", () => {
    expect(pickWeakest([s("P1", "covered"), s("P2", "partial"), s("P3", "missing")])).toBe("P3")
    expect(pickWeakest([s("P1", "covered"), s("P2", "partial")])).toBe("P2")
    expect(pickWeakest([s("P1", "covered")])).toBeNull()
  })
})
