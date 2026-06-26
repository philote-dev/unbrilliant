import { describe, it, expect, vi } from "vitest"
import { scoreExplanation } from "./score"
import type { Completer } from "../openai"

function completer(reply: string): Completer {
  return { complete: vi.fn().mockResolvedValue(reply) }
}

const base = { conceptId: "stacks", explanation: "last thing in is first out" }

describe("scoreExplanation", () => {
  it("parses a clean JSON verdict and surfaces the weakest", async () => {
    const c = completer(
      '{"scores":[{"id":"P1","verdict":"covered"},{"id":"P2","verdict":"missing"},{"id":"P3","verdict":"partial"}],"weakest":"P2"}',
    )
    const res = await scoreExplanation(c, "m", base)
    expect(res.scores).toEqual([
      { id: "P1", verdict: "covered" },
      { id: "P2", verdict: "missing" },
      { id: "P3", verdict: "partial" },
    ])
    expect(res.weakest).toBe("P2")
  })

  it("tolerates JSON wrapped in prose", async () => {
    const c = completer('Here you go: {"scores":[{"id":"P1","verdict":"covered"}],"weakest":null} thanks')
    const res = await scoreExplanation(c, "m", base)
    expect(res.scores[0]).toEqual({ id: "P1", verdict: "covered" })
  })

  it("falls back to all-covered (no probe) when the reply is not parseable", async () => {
    const c = completer("sorry I cannot do that")
    const res = await scoreExplanation(c, "m", base)
    expect(res.scores.every((s) => s.verdict === "covered")).toBe(true)
    expect(res.weakest).toBeNull()
  })

  it("derives the weakest (first missing) when the model omits or mis-states it", async () => {
    const c = completer(
      '{"scores":[{"id":"P1","verdict":"covered"},{"id":"P2","verdict":"missing"},{"id":"P3","verdict":"missing"}]}',
    )
    const res = await scoreExplanation(c, "m", base)
    expect(res.weakest).toBe("P2")
  })

  it("returns empty and no weakest for an unknown concept (no model call)", async () => {
    const c = completer("unused")
    const res = await scoreExplanation(c, "m", { conceptId: "nope", explanation: "x" })
    expect(res).toEqual({ scores: [], weakest: null })
    expect(c.complete).not.toHaveBeenCalled()
  })
})
