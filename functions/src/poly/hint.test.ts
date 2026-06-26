import { describe, it, expect, vi } from "vitest"
import { generateHint } from "./hint"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const base = {
  stageId: "stacks-and-queues",
  skill: "stackConstruct",
  discipline: "stack" as const,
  learnerOrder: ["A", "B", "C"],
}

describe("generateHint", () => {
  it("returns a clean hint on the first try (one model call)", async () => {
    const c = completer("Think about which card you can actually reach first.")
    const res = await generateHint(c, "m", base)
    expect(res.hint).toBe("Think about which card you can actually reach first.")
    expect(c.complete).toHaveBeenCalledTimes(1)
  })

  it("regenerates once when the first hint leaks a withheld concept token", async () => {
    // "LIFO" is a withheld P1 token for stackConstruct -> first is rejected.
    const c = completer("Remember it is LIFO.", "Look at the card you placed first.")
    const res = await generateHint(c, "m", base)
    expect(res.hint).toBe("Look at the card you placed first.")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  it("returns null when even the retry leaks (never render a giveaway)", async () => {
    const c = completer("It is LIFO.", "Still last in first out.")
    const res = await generateHint(c, "m", base)
    expect(res.hint).toBeNull()
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  it("returns null without calling the model for an unmapped skill", async () => {
    const c = completer("unused")
    const res = await generateHint(c, "m", { ...base, skill: "stackPredict" })
    expect(res.hint).toBeNull()
    expect(c.complete).not.toHaveBeenCalled()
  })

  it("passes the prior hint into the prompt to force a different angle", async () => {
    const c = completer("A fresh angle.")
    await generateHint(c, "m", { ...base, priorHint: "earlier hint" })
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.user).toContain("earlier hint")
  })
})
