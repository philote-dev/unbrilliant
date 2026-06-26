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
