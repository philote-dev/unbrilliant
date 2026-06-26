import { describe, it, expect, vi, beforeEach } from "vitest"
import { httpsCallable } from "firebase/functions"

const { mockCallable } = vi.hoisted(() => ({ mockCallable: vi.fn() }))

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => mockCallable),
}))
vi.mock("@/lib/firebase", () => ({ functions: {} }))

import { polyHealthCheck } from "./polyClient"

describe("polyHealthCheck client", () => {
  beforeEach(() => mockCallable.mockReset())

  it("returns the callable's result data", async () => {
    mockCallable.mockResolvedValue({
      data: { ok: true, model: "m", reply: "pong", uid: null },
    })
    const res = await polyHealthCheck()
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(
      expect.anything(),
      "polyHealthCheck",
    )
    expect(res).toEqual({ ok: true, model: "m", reply: "pong", uid: null })
  })
})

describe("requestHint client", () => {
  beforeEach(() => mockCallable.mockReset())

  it("calls the polyHint callable and returns its data", async () => {
    const { requestHint } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { hint: "a nudge" } })

    const res = await requestHint({
      stageId: "stacks-and-queues",
      skill: "stackConstruct",
      discipline: "stack",
      learnerOrder: ["A", "B", "C"],
    })

    expect(res).toEqual({ hint: "a nudge" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyHint")
  })
})
