import { describe, it, expect, vi } from "vitest"
import { probeQuestion } from "./probe"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const base = { conceptId: "stacks", propositionId: "P1", explanation: "I push cards" }

describe("probeQuestion", () => {
  it("returns a clean probe question on the first try", async () => {
    const c = completer("What happens to the card you set down most recently?")
    const res = await probeQuestion(c, "m", base)
    expect(res.question).toBe("What happens to the card you set down most recently?")
    expect(c.complete).toHaveBeenCalledTimes(1)
  })

  it("regenerates once when the probe leaks the withheld proposition token", async () => {
    const c = completer("Is it LIFO here?", "Which card can you take off first?")
    const res = await probeQuestion(c, "m", base)
    expect(res.question).toBe("Which card can you take off first?")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  it("returns null when even the retry leaks", async () => {
    const c = completer("It is LIFO.", "Still last in first out.")
    const res = await probeQuestion(c, "m", base)
    expect(res.question).toBeNull()
  })

  it("returns null for an unknown concept or proposition (no model call)", async () => {
    const c = completer("unused")
    expect((await probeQuestion(c, "m", { ...base, propositionId: "ZZ" })).question).toBeNull()
    expect(c.complete).not.toHaveBeenCalled()
  })
})
