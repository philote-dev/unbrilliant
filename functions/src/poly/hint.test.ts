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

  // Multi-step (complex) beats carry an operation trace plus a structural
  // diagnosis computed on the client; the correct sequence is never sent.
  const complexBase = {
    ...base,
    learnerOrder: ["A", "B", "C", "D"],
    attempt: ["push A", "push B", "push C", "push D", "pop", "pop", "pop", "pop"],
    diagnosis: { kind: "covered-a-needed-item", stepNumber: 3 },
  }

  it("grounds a complex hint in the diagnosis (the prompt names the misstep and the moves)", async () => {
    const c = completer("Right at your third move, was something already within reach?")
    const res = await generateHint(c, "m", complexBase)
    expect(res.hint).toBe("Right at your third move, was something already within reach?")
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.user).toContain("move 3")
    expect(call.user).toContain("push C")
    expect(call.user).toContain("covered-a-needed-item")
  })

  it("never asks the model to state the sequence on the complex path", async () => {
    const c = completer("Look again at that one move.")
    await generateHint(c, "m", complexBase)
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.user).toContain("Do NOT state the correct sequence")
  })

  it("still rejects a giveaway and regenerates on the complex path", async () => {
    const c = completer("It is LIFO.", "Look again at your third move.")
    const res = await generateHint(c, "m", complexBase)
    expect(res.hint).toBe("Look again at your third move.")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  const growBase = {
    stageId: "arrays",
    skill: "grow",
    discipline: "array" as const,
    learnerOrder: ["grow the block by one slot"],
  }

  it("builds a grow hint from the arrays concept and never states the fix", async () => {
    const c = completer("What happens the very next time you add one after that?")
    const res = await generateHint(c, "m", growBase)
    expect(res.hint).toBe("What happens the very next time you add one after that?")
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.user).toContain("grow the block by one slot")
    expect(call.user).toContain("Never state the fix")
  })

  it("rejects a grow hint that leaks the doubling fix, then regenerates", async () => {
    // "double" is a withheld P3 token for the arrays grow skill -> first is rejected.
    const c = completer("Just double the block.", "Think about the next add, and the one after.")
    const res = await generateHint(c, "m", growBase)
    expect(res.hint).toBe("Think about the next add, and the one after.")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })
})
