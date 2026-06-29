import { describe, it, expect, vi } from "vitest"
import { generateHint } from "./hint"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

// The nudge branch is concept-agnostic (it uses only the discipline + the
// diagnosis step, never concept tokens), so a currently-mapped skill fully
// exercises it. We deliberately use a mapped skill here so generateHint reaches
// buildUser/generateVerified; an unmapped skill (e.g. the not-yet-added llInsert)
// would early-return null, and softening that guard for nudges would open a
// cost/abuse vector on the public callable and weaken the giveaway verifier.
const nudgeArgs = {
  stageId: "stacks-and-queues",
  skill: "stackConstruct",
  discipline: "stack" as const,
  learnerOrder: [],
  mode: "nudge" as const,
  diagnosis: { kind: "incomplete", stepNumber: 1 },
}

describe("generateHint nudge mode", () => {
  it("asks for an orienting nudge, not a direct hint", async () => {
    const c = completer("What should you double-check before your next move?")
    const res = await generateHint(c, "m", nudgeArgs)
    expect(res.hint).toBe("What should you double-check before your next move?")
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.system).toContain("where to think")
    expect(call.user).toContain("stuck")
  })
})
