import { describe, it, expect, vi } from "vitest"
import { runHealthCheck } from "./healthCheck"
import type { Completer } from "./openai"

function completerReturning(reply: string): Completer {
  return { complete: vi.fn().mockResolvedValue(reply) }
}

describe("runHealthCheck", () => {
  it("returns ok with the trimmed reply, model, and uid", async () => {
    const res = await runHealthCheck(completerReturning("  pong\n"), "gpt-test", "user-1")
    expect(res).toEqual({ ok: true, model: "gpt-test", reply: "pong", uid: "user-1" })
  })

  it("passes a null uid through for anonymous callers", async () => {
    const res = await runHealthCheck(completerReturning("pong"), "gpt-test", null)
    expect(res.uid).toBeNull()
  })

  it("propagates completer errors to the caller", async () => {
    const failing: Completer = { complete: vi.fn().mockRejectedValue(new Error("boom")) }
    await expect(runHealthCheck(failing, "gpt-test", null)).rejects.toThrow("boom")
  })
})
